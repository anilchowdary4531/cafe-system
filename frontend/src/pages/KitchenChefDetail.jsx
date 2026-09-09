import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
    ArrowLeft,
    Ban,
    Bell,
    BellOff,
    CheckCircle2,
    ChefHat,
    Clock,
    Flame,
    History,
    LoaderCircle,
    MoreVertical,
    RefreshCw,
    Sparkles,
    UtensilsCrossed,
    Volume2,
    VolumeX,
    X,
    User,
    Check,
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
    { avatarBg: "from-amber-500 to-orange-600", avatarText: "text-white", glow: "shadow-amber-500/20", ring: "border-amber-500/30" },
    { avatarBg: "from-orange-500 to-amber-600", avatarText: "text-white", glow: "shadow-orange-500/20", ring: "border-orange-500/30" },
    { avatarBg: "from-yellow-500 to-amber-600", avatarText: "text-black", glow: "shadow-yellow-500/20", ring: "border-yellow-500/30" },
    { avatarBg: "from-amber-600 to-red-600", avatarText: "text-white", glow: "shadow-red-500/20", ring: "border-red-500/30" },
];

const ACTION_BADGES = {
    ASSIGNED: { bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", label: "Assigned" },
    REASSIGNED: { bg: "bg-amber-500/10 text-amber-400 border-amber-500/20", label: "Reassigned" },
    UNASSIGNED: { bg: "bg-zinc-800 text-zinc-400 border-zinc-700", label: "Unassigned" },
    COMPLETED: { bg: "bg-teal-500/10 text-teal-300 border-teal-500/20", label: "Completed" },
    DECLINED: { bg: "bg-red-500/10 text-red-500 border-red-500/20", label: "Declined" },
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

function MetricCard({ icon: Icon, label, value, hint, accentColor = "amber" }) {
    return (
        <div className="relative overflow-hidden py-2 px-1">
            <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-${accentColor}-500/15 text-${accentColor}-500 border border-${accentColor}-500/20`}>
                    <Icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-extrabold uppercase tracking-widest theme-muted">{label}</p>
                    <p className="mt-0.5 text-xl font-black tracking-tight text-[var(--app-text)]">{value}</p>
                    {hint ? <p className="text-[10px] font-medium theme-muted truncate mt-0.5">{hint}</p> : null}
                </div>
            </div>
        </div>
    );
}

function ModernTicketCard({
    ticket,
    chef,
    chefLabel,
    onAction,
    onDecline,
    actionLabel = "Complete",
    actionIcon = <CheckCircle2 size={15} />,
    isPickAction = false,
}) {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        if (!menuOpen) return undefined;
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [menuOpen]);

    return (
        <article className="group relative border-b border-[var(--app-border)]/60 py-3.5 last:border-b-0 transition-colors duration-150">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="rounded-md bg-[color-mix(in_srgb,var(--app-primary)_18%,transparent)] px-2 py-0.5 text-xs font-black text-[var(--app-primary)]">
                            {ticket.qty}x
                        </span>
                        <h4 className="font-extrabold text-base text-[var(--app-text)] truncate tracking-tight group-hover:text-[var(--app-primary)] transition duration-200">
                            {ticket.itemName}
                        </h4>
                        <span className="text-sm font-black theme-price tabular-nums">
                            {formatKitchenMoney(ticket.lineTotal)}
                        </span>
                    </div>

                    <div className="mt-1.5 flex items-center gap-2 text-xs flex-wrap">
                        <span className="font-bold text-[11px] theme-muted">
                            {ticket.orderRef}
                        </span>
                        {ticket.tableNo && (
                            <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                                Table {ticket.tableNo}
                            </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-500">
                            <Clock size={12} />
                            {ticket.ageText}
                        </span>
                        <span className="text-[10px] font-extrabold uppercase tracking-widest theme-muted">
                            • <span className="text-emerald-500 font-bold">{String(ticket.orderStatus || "").replace(/_/g, " ")}</span>
                        </span>
                    </div>
                </div>

                <div className="text-right shrink-0 flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onAction?.(ticket.itemKey)}
                        className={`rounded-xl px-3.5 py-1.5 text-xs font-black transition flex items-center gap-1.5 shadow-sm cursor-pointer ${
                            isPickAction
                                ? "bg-amber-500 hover:bg-amber-400 text-black"
                                : "bg-emerald-500 hover:bg-emerald-400 text-black"
                        }`}
                    >
                        {actionIcon}
                        {actionLabel}
                    </button>

                    {/* Three Dots Options Menu */}
                    <div className="relative" ref={menuRef}>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpen((prev) => !prev);
                            }}
                            className="p-1.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] theme-muted hover:text-[var(--app-text)] hover:border-[var(--app-border-strong)] transition cursor-pointer flex items-center justify-center"
                            title="More options"
                        >
                            <MoreVertical size={16} />
                        </button>

                        {menuOpen && (
                            <div className="absolute right-0 top-full mt-1.5 z-50 w-44 rounded-2xl theme-modal p-1.5 shadow-xl border border-[var(--app-border)]">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMenuOpen(false);
                                        onDecline?.(ticket);
                                    }}
                                    className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-extrabold text-red-500 hover:bg-red-500/10 transition text-left cursor-pointer"
                                >
                                    <Ban size={14} />
                                    <span>Decline Item</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {ticket.notes ? (
                <div className="mt-2 rounded-xl bg-[color-mix(in_srgb,var(--app-primary)_8%,transparent)] px-3 py-1.5 text-xs italic text-[var(--app-text)] flex items-start gap-1.5 border-l-2 border-[var(--app-primary)]">
                    <Sparkles size={14} className="text-[var(--app-primary)] shrink-0 mt-0.5" />
                    <span>"{ticket.notes}"</span>
                </div>
            ) : null}
        </article>
    );
}

function ModernHistoryCard({ entry, chef }) {
    const badge = ACTION_BADGES[String(entry?.action || "ASSIGNED").toUpperCase()] || ACTION_BADGES.ASSIGNED;

    return (
        <article className="border-b border-[var(--app-border)]/60 py-3 last:border-b-0 transition-colors duration-150">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h5 className="font-extrabold text-sm text-[var(--app-text)] tracking-tight">
                        {entry.itemName || "Item"}
                    </h5>
                    <p className="mt-0.5 text-xs theme-muted">
                        {entry.orderRef || "Order"} {entry.orderLabel ? `• ${entry.orderLabel}` : ""} {entry.qty ? `(${entry.qty}x)` : ""}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase border ${badge.bg}`}>
                        {badge.label}
                    </span>
                    <span className="text-[11px] font-bold theme-muted">
                        {entry.chefName || chef?.name || "Chef"}
                    </span>
                </div>
            </div>

            <div className="mt-2 flex items-center gap-2 text-[11px] font-semibold theme-muted">
                <span>{getTimeLabel(entry.timestamp)}</span>
                <span>•</span>
                <span className="text-[var(--app-primary)]">{getRelativeLabel(entry.timestamp)}</span>
            </div>

            {entry.note ? <p className="mt-1 text-xs italic theme-muted">Note: {entry.note}</p> : null}
        </article>
    );
}

export default function KitchenChefDetail() {
    const { chefId: chefIdParam } = useParams();
    const targetChefId = String(chefIdParam || "").trim();
    const { user } = useAuth();
    const { socket, connected, error: socketError } = useStaffSocket();

    const restaurantId = Number(
        user?.restaurantId ||
        user?.restaurant?.id ||
        user?.restaurant_id ||
        localStorage.getItem("restaurantId") ||
        localStorage.getItem("selectedRestaurantId") ||
        localStorage.getItem("owner_restaurant_id") ||
        1
    );
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

    const currentChef = useMemo(() => {
        if (!targetChefId) return null;
        if (chefById.has(targetChefId)) return chefById.get(targetChefId);

        const rawStaff = Array.isArray(staffUsers) ? staffUsers.find((s) => String(s.id) === targetChefId) : null;
        if (rawStaff) {
            return {
                ...rawStaff,
                id: String(rawStaff.id),
                palette: CHEF_PALETTES[0],
            };
        }

        return {
            id: targetChefId,
            name: `Chef #${targetChefId}`,
            designation: "Chef",
            palette: CHEF_PALETTES[0],
        };
    }, [chefById, staffUsers, targetChefId]);

    const ticketRows = useMemo(() => buildKitchenTicketRows(activeOrders), [activeOrders]);

    const assignmentsPruned = useMemo(() => {
        const next = {};
        ticketRows.forEach((ticket) => {
            const chefId = String(assignments?.[ticket.itemKey] || "").trim();
            if (chefId && (chefById.has(chefId) || chefId === targetChefId)) {
                next[ticket.itemKey] = chefId;
            }
        });
        return next;
    }, [assignments, chefById, targetChefId, ticketRows]);

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

    const [declineModalItem, setDeclineModalItem] = useState(null);
    const [declineReason, setDeclineReason] = useState("");

    const REASON_PRESETS = [
        "Out of stock / Ingredients missing",
        "Kitchen station / Equipment issue",
        "High order queue / Over capacity",
        "Special prep request cannot be fulfilled",
        "Customer requested cancellation",
    ];

    const handleConfirmDecline = useCallback(() => {
        if (!declineModalItem || !declineReason.trim()) return;

        const ticket = declineModalItem;
        const reasonText = declineReason.trim();

        setAssignments((prev) => {
            const next = { ...(prev || {}) };
            delete next[ticket.itemKey];
            return next;
        });

        const storedEntry = appendKitchenAssignmentHistory(
            restaurantId,
            createKitchenAssignmentHistoryEntry({
                action: "DECLINED",
                item: ticket,
                chef: currentChef,
                note: `Declined: ${reasonText}`,
            })
        );

        if (storedEntry) {
            setHistoryEntries((prev) => [...prev, storedEntry]);
        }

        showToast({
            title: "Item Declined",
            message: `${ticket.itemName} (${ticket.orderRef}) was declined: "${reasonText}"`,
            variant: "error",
            durationMs: 3000,
        });

        setDeclineModalItem(null);
        setDeclineReason("");
    }, [currentChef, declineModalItem, declineReason, restaurantId]);

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

    useEffect(() => {
        if (!historyOpen && !soundModalOpen && !declineModalItem) return undefined;

        const onKeyDown = (event) => {
            if (event.key === "Escape") {
                setHistoryOpen(false);
                setSoundModalOpen(false);
                setDeclineModalItem(null);
                setDeclineReason("");
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

    return (
        <div className="min-h-screen theme-page selection:bg-amber-500 selection:text-black font-sans relative overflow-x-hidden">
            {/* Ambient Background Gradient Glows */}
            <div className="pointer-events-none fixed -top-40 -left-40 h-96 w-96 rounded-full bg-[var(--app-primary)]/10 blur-[120px]" />
            <div className="pointer-events-none fixed top-1/3 -right-40 h-96 w-96 rounded-full bg-[var(--app-accent)]/10 blur-[140px]" />

            {/* TOP GLASS NAVIGATION BAR */}
            <header className="sticky top-0 z-40 theme-nav border-b border-[var(--app-border)] px-4 py-3.5 sm:px-6 md:px-8">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link
                            to="/kitchen"
                            className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] px-3.5 py-2 text-xs font-black text-[var(--app-text)] transition hover:border-[var(--app-border-strong)] flex items-center gap-2 shadow-md cursor-pointer"
                        >
                            <ArrowLeft size={16} />
                            <span>Kitchen Board</span>
                        </Link>
                        <div>
                            <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] theme-brand-text">{restaurantName}</p>
                            <h1 className="text-lg font-black tracking-tight text-[var(--app-text)] flex items-center gap-2">
                                {pageTitle}
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                        {/* Live Socket Status */}
                        <div className="hidden sm:flex items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] px-3 py-1.5 text-xs font-bold theme-muted">
                            <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                            <span>{connected ? "Socket Live" : "Reconnecting"}</span>
                        </div>

                        {/* Order Sound Alert Trigger */}
                        <button
                            type="button"
                            onClick={() => setSoundModalOpen(true)}
                            className="rounded-xl border border-[var(--app-border-strong)] bg-[color-mix(in_srgb,var(--app-primary)_15%,transparent)] px-3.5 py-2 text-xs font-black text-[var(--app-primary)] hover:bg-[color-mix(in_srgb,var(--app-primary)_25%,transparent)] transition flex items-center gap-2 shadow-md cursor-pointer"
                        >
                            {soundMuted ? <BellOff size={16} className="theme-muted" /> : <Bell size={16} className="animate-pulse" />}
                            <span className="hidden sm:inline">{soundMuted ? "Muted" : "Alerts On"}</span>
                        </button>

                        <button
                            type="button"
                            onClick={refreshBoard}
                            disabled={refreshing || ordersLoading || staffLoading}
                            className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-2 text-[var(--app-text)] hover:border-[var(--app-border-strong)] transition cursor-pointer"
                            title="Refresh Board"
                        >
                            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
                        </button>
                    </div>
                </div>
            </header>

            {/* MAIN DASHBOARD CONTENT */}
            <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:px-8 space-y-6">

                {/* CHEF HERO IDENTITY & METRICS HEADER */}
                <div className="py-2 pb-6 border-b border-[var(--app-border)]/60 relative overflow-hidden">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                        
                        {/* Chef Profile Badge */}
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500 text-black font-black text-xl shadow-md border-2 border-amber-400/40">
                                    <ChefHat size={28} />
                                </div>
                                <span className="absolute -bottom-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-emerald-500 text-black border-2 border-[var(--app-bg)]">
                                    <Check size={10} strokeWidth={3} />
                                </span>
                            </div>

                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--app-text)]">{pageTitle}</h2>
                                    <span className="rounded-full bg-[color-mix(in_srgb,var(--app-primary)_15%,transparent)] px-3 py-0.5 text-xs font-black text-[var(--app-primary)]">
                                        {pageDesignation}
                                    </span>
                                </div>
                                <p className="text-xs theme-muted mt-0.5 flex items-center gap-2">
                                    <span>{restaurantName} Kitchen Station</span>
                                    <span>•</span>
                                    <span className="text-emerald-500 font-semibold">Active Dispatch Station</span>
                                </p>
                            </div>
                        </div>

                        {/* Quick Action Controls */}
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setHistoryOpen(true)}
                                className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] text-[var(--app-text)] hover:border-[var(--app-primary)] px-4 py-2 text-xs font-black transition flex items-center gap-2 shadow-sm cursor-pointer"
                            >
                                <History size={16} className="text-[var(--app-primary)]" />
                                <span>Activity History ({relevantHistory.length})</span>
                            </button>
                        </div>
                    </div>

                    {/* Metric Cards Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-[var(--app-border)]/40">
                        <MetricCard
                            icon={Flame}
                            label="Live Orders"
                            value={metrics.liveOrdersCount}
                            hint="Orders currently active on pass"
                            accentColor="amber"
                        />
                        <MetricCard
                            icon={CheckCircle2}
                            label="Past Completed"
                            value={metrics.pastEvents}
                            hint="Completed item assignments"
                            accentColor="emerald"
                        />
                        <MetricCard
                            icon={Clock}
                            label="Oldest Ticket Wait"
                            value={formatKitchenAge(metrics.oldestMinutes)}
                            hint="Longest waiting item on board"
                            accentColor="orange"
                        />
                    </div>
                </div>

                {/* BOARD COLUMNS: PASS (PICK) VS LIVE LOAD (ASSIGNED) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-2">

                    {/* LEFT COLUMN: LIVE ORDERS TO PICK FROM PASS */}
                    <section className="space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-[var(--app-border)]/60">
                            <div className="flex items-center gap-2.5">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
                                    <Flame size={16} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black tracking-tight text-[var(--app-text)]">Pick from Pass</h3>
                                    <p className="text-[11px] theme-muted">Claim an open ticket to add to your live cooking queue</p>
                                </div>
                            </div>
                            <span className="rounded-full bg-[color-mix(in_srgb,var(--app-primary)_18%,transparent)] px-2.5 py-0.5 text-xs font-black text-[var(--app-primary)]">
                                {availableTickets.length} Open
                            </span>
                        </div>

                        <div className="min-h-[250px]">
                            {ordersLoading || staffLoading ? (
                                <div className="flex flex-col items-center justify-center py-12 theme-muted space-y-2">
                                    <LoaderCircle size={24} className="animate-spin text-[var(--app-primary)]" />
                                    <p className="text-xs font-bold uppercase tracking-wider">Syncing Pass Tickets...</p>
                                </div>
                            ) : availableTickets.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center p-6 space-y-2">
                                    <UtensilsCrossed size={32} className="theme-muted opacity-40" />
                                    <h4 className="text-sm font-bold text-[var(--app-text)]">Pass is Clear!</h4>
                                    <p className="text-xs theme-muted max-w-xs">No unassigned tickets waiting on the pass right now.</p>
                                </div>
                            ) : (
                                availableTickets.map((ticket) => (
                                    <ModernTicketCard
                                        key={ticket.itemKey}
                                        ticket={ticket}
                                        chef={null}
                                        chefLabel="Unassigned"
                                        onAction={handlePickTicket}
                                        onDecline={(t) => setDeclineModalItem(t)}
                                        actionLabel="Pick Ticket"
                                        actionIcon={<ChefHat size={15} />}
                                        isPickAction={true}
                                    />
                                ))
                            )}
                        </div>
                    </section>

                    {/* RIGHT COLUMN: CHEF'S LIVE LOAD (ASSIGNED TO THIS CHEF) */}
                    <section className="space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-[var(--app-border)]/60">
                            <div className="flex items-center gap-2.5">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                                    <ChefHat size={16} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black tracking-tight text-[var(--app-text)]">My Live Cooking Load</h3>
                                    <p className="text-[11px] theme-muted">Tickets currently assigned to {pageTitle}</p>
                                </div>
                            </div>
                            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-black text-emerald-500">
                                {currentTickets.length} Active
                            </span>
                        </div>

                        <div className="min-h-[250px]">
                            {ordersLoading || staffLoading ? (
                                <div className="flex flex-col items-center justify-center py-12 theme-muted space-y-2">
                                    <LoaderCircle size={24} className="animate-spin text-emerald-500" />
                                    <p className="text-xs font-bold uppercase tracking-wider">Syncing Live Load...</p>
                                </div>
                            ) : currentTickets.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center p-6 space-y-2">
                                    <ChefHat size={32} className="theme-muted opacity-40" />
                                    <h4 className="text-sm font-bold text-[var(--app-text)]">No Active Load</h4>
                                    <p className="text-xs theme-muted max-w-xs">Pick orders from the left column to start cooking.</p>
                                </div>
                            ) : (
                                currentTickets.map((ticket) => (
                                    <ModernTicketCard
                                        key={ticket.itemKey}
                                        ticket={ticket}
                                        chef={currentChef}
                                        onAction={handleCompleteTicket}
                                        onDecline={(t) => setDeclineModalItem(t)}
                                        actionLabel="Mark Complete"
                                        actionIcon={<CheckCircle2 size={15} />}
                                        isPickAction={false}
                                    />
                                ))
                            )}
                        </div>
                    </section>

                </div>
            </main>

            {/* ACTIVITY HISTORY MODAL */}
            {historyOpen && (
                <div
                    className="theme-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
                    onClick={() => setHistoryOpen(false)}
                >
                    <div
                        className="theme-modal w-full max-w-3xl rounded-3xl p-6 space-y-5 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--app-primary)_15%,transparent)] text-[var(--app-primary)] border border-[var(--app-border-strong)]">
                                    <History size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-[var(--app-text)]">Activity Trail — {pageTitle}</h3>
                                    <p className="text-xs theme-muted">Past item assignments and completion logs</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setHistoryOpen(false)}
                                className="rounded-xl border border-[var(--app-border)] p-2 theme-muted hover:text-[var(--app-text)] hover:bg-[var(--app-surface-2)] transition cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1">
                            {relevantHistory.length === 0 ? (
                                <p className="text-center text-xs theme-muted py-10">No activity trail recorded for this chef yet.</p>
                            ) : (
                                relevantHistory.map((entry) => (
                                    <ModernHistoryCard
                                        key={entry.id || `${entry.timestamp}-${entry.itemKey}`}
                                        entry={entry}
                                        chef={currentChef}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* SOUND SETTINGS MODAL */}
            {soundModalOpen && (
                <div
                    className="theme-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
                    onClick={() => setSoundModalOpen(false)}
                >
                    <div
                        className="theme-modal w-full max-w-2xl rounded-3xl p-6 space-y-5 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--app-primary)_15%,transparent)] text-[var(--app-primary)] border border-[var(--app-border-strong)]">
                                    <Bell size={20} className="animate-pulse" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-[var(--app-text)]">Kitchen Order Chime & Alerts</h3>
                                    <p className="text-xs theme-muted">Configure real-time ticket arrival audio alerts</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSoundModalOpen(false)}
                                className="rounded-xl border border-[var(--app-border)] p-2 theme-muted hover:text-[var(--app-text)] hover:bg-[var(--app-surface-2)] transition cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-4">
                                <div className="flex items-center gap-3">
                                    {soundMuted ? <VolumeX size={20} className="theme-muted" /> : <Volume2 size={20} className="text-[var(--app-primary)]" />}
                                    <div>
                                        <p className="text-sm font-bold text-[var(--app-text)]">{soundMuted ? "Sound Alerts Muted" : "Sound Alerts Active"}</p>
                                        <p className="text-xs theme-muted">Plays notification sound when new orders arrive</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={toggleSoundMute}
                                    className={`rounded-xl px-4 py-2 text-xs font-black transition cursor-pointer ${
                                        soundMuted
                                            ? "theme-button"
                                            : "bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30"
                                    }`}
                                >
                                    {soundMuted ? "Unmute Sound" : "Mute Sound"}
                                </button>
                            </div>

                            <NotificationSoundPicker />
                        </div>
                    </div>
                </div>
            )}

            {/* DECLINE ITEM REASON MODAL */}
            {declineModalItem && (
                <div
                    className="theme-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
                    onClick={() => {
                        setDeclineModalItem(null);
                        setDeclineReason("");
                    }}
                >
                    <div
                        className="theme-modal w-full max-w-lg rounded-3xl p-6 space-y-5 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-500/15 text-red-500 border border-red-500/30">
                                    <Ban size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-[var(--app-text)]">Decline Item</h3>
                                    <p className="text-xs theme-muted">Specify reason for declining {declineModalItem.itemName}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setDeclineModalItem(null);
                                    setDeclineReason("");
                                }}
                                className="rounded-xl border border-[var(--app-border)] p-2 theme-muted hover:text-[var(--app-text)] hover:bg-[var(--app-surface-2)] transition cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3.5 space-y-1">
                                <p className="text-xs font-bold text-[var(--app-text)]">{declineModalItem.qty}x {declineModalItem.itemName}</p>
                                <p className="text-[11px] theme-muted">{declineModalItem.orderRef} • Table {declineModalItem.tableNo || "N/A"}</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider theme-muted block">Select Common Reason</label>
                                <div className="flex flex-wrap gap-2">
                                    {REASON_PRESETS.map((preset) => (
                                        <button
                                            key={preset}
                                            type="button"
                                            onClick={() => setDeclineReason(preset)}
                                            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer border ${
                                                declineReason === preset
                                                    ? "bg-red-500 text-white border-red-500 font-extrabold shadow-sm"
                                                    : "bg-[var(--app-surface-2)] text-[var(--app-text)] border-[var(--app-border)] hover:border-red-500/40"
                                            }`}
                                        >
                                            {preset}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider theme-muted block">Or Specify Reason</label>
                                <textarea
                                    rows={3}
                                    value={declineReason}
                                    onChange={(e) => setDeclineReason(e.target.value)}
                                    placeholder="Type reason for declining this item..."
                                    className="theme-input w-full rounded-2xl p-3 text-xs outline-none focus:ring-2 focus:ring-red-500/40"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--app-border)]">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setDeclineModalItem(null);
                                        setDeclineReason("");
                                    }}
                                    className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] px-4 py-2 text-xs font-extrabold text-[var(--app-text)] hover:bg-white/5 transition cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmDecline}
                                    disabled={!declineReason.trim()}
                                    className="rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white px-4 py-2 text-xs font-extrabold transition shadow-md cursor-pointer flex items-center gap-1.5"
                                >
                                    <Ban size={14} />
                                    <span>Confirm Decline</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
