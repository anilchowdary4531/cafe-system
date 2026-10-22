import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
    AlertTriangle,
    Bell,
    BellOff,
    CheckCircle2,
    ChefHat,
    Clock3,
    Flame,
    Filter,
    LoaderCircle,
    LogOut,
    Printer,
    RefreshCw,
    Search,
    Sparkles,
    UtensilsCrossed,
    Volume2,
    VolumeX,
    X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useStaffSocket } from "../context/StaffSocketContext";
import { api } from "../utils/apiClient";
import NotificationSoundPicker from "../components/NotificationSoundPicker";
import { playNotificationSound } from "../utils/soundPlayer";
import { resolveEffectiveStaffRole } from "../utils/staffRole";
import { showToast } from "../utils/toast";
import ServerProfileView from "../components/ServerProfileView";
import ServerNotificationsView from "../components/ServerNotificationsView";

const KOT_STATUSES = ["ALL", "PENDING", "PREPARING", "READY", "SERVED", "CANCELLED"];
const PRIORITIES = ["ALL", "NORMAL", "HIGH", "URGENT"];

const formatAge = (minutes) => {
    if (minutes === null || minutes === undefined) return "-";
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
};

const getSlaStatus = (createdAtIso, estPrepMins = 15) => {
    if (!createdAtIso) return { label: "ON TIME", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200", elapsed: 0 };
    const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(createdAtIso).getTime()) / 60000));
    const est = Math.max(1, Number(estPrepMins || 15));
    const ratio = elapsedMinutes / est;

    if (ratio > 1.0) {
        return { label: "OVERDUE", badgeClass: "bg-red-50 text-red-700 border-red-200 font-semibold", elapsed: elapsedMinutes };
    }
    if (ratio >= 0.8) {
        return { label: "WARNING", badgeClass: "bg-amber-50 text-amber-700 border-amber-200 font-semibold", elapsed: elapsedMinutes };
    }
    return { label: "ON TIME", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200", elapsed: elapsedMinutes };
};

const priorityBadgeClass = (priority) => {
    switch (String(priority || "").toUpperCase()) {
        case "URGENT":
            return "bg-red-50 text-red-700 border border-red-200 font-bold";
        case "HIGH":
            return "bg-amber-50 text-amber-700 border border-amber-200 font-semibold";
        default:
            return "bg-slate-100 text-slate-600 border border-slate-200 font-medium";
    }
};

const sourceBadgeClass = (source) => {
    switch (String(source || "").toUpperCase()) {
        case "POS":
            return "bg-blue-50 text-blue-700 border border-blue-200";
        case "QR":
            return "bg-purple-50 text-purple-700 border border-purple-200";
        case "DELIVERY":
            return "bg-amber-50 text-amber-700 border border-amber-200";
        case "TAKEAWAY":
            return "bg-emerald-50 text-emerald-700 border border-emerald-200";
        default:
            return "bg-slate-100 text-slate-600 border border-slate-200";
    }
};

export default function Kitchen() {
    const { user, logout } = useAuth();
    const { socket, connected, error: socketError } = useStaffSocket();

    const restaurantId = Number(
        user?.restaurantId ||
        user?.restaurant?.id ||
        user?.restaurant_id ||
        localStorage.getItem("restaurantId") ||
        localStorage.getItem("selectedRestaurantId") ||
        1
    );

    const restaurantName = String(user?.restaurant?.name || "Restaurant").trim() || "Restaurant";
    const effectiveRole = resolveEffectiveStaffRole(user?.role, user?.designation);
    const isSeniorChef = /SENIOR/i.test(String(user?.designation || ""));
    const titleLabel = isSeniorChef ? "Senior Chef Dispatch KDS" : "Kitchen Operations KDS";

    const location = useLocation();
    const navigate = useNavigate();

    // Active View Mode: "KDS" | "PROFILE" | "NOTIFICATIONS"
    const getInitialViewMode = () => {
        if (location.pathname.endsWith("/profile")) return "PROFILE";
        if (location.pathname.endsWith("/notifications")) return "NOTIFICATIONS";
        return "KDS";
    };
    const [viewMode, setViewMode] = useState(getInitialViewMode);

    useEffect(() => {
        if (location.pathname.endsWith("/profile")) {
            setViewMode("PROFILE");
        } else if (location.pathname.endsWith("/notifications")) {
            setViewMode("NOTIFICATIONS");
        } else {
            setViewMode("KDS");
        }
    }, [location.pathname]);

    // Unread Notifications Badge
    const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

    const fetchUnreadCount = useCallback(async () => {
        try {
            const res = await api.get("/api/notifications/unread-count");
            if (res.data?.success) {
                setUnreadNotificationCount(res.data.count || 0);
                return;
            }
        } catch {
            // fallback
        }
        try {
            const res = await api.get("/notifications/unread-count");
            if (res.data?.success) {
                setUnreadNotificationCount(res.data.count || 0);
            }
        } catch {
            // fallback silently
        }
    }, []);

    useEffect(() => {
        fetchUnreadCount();
    }, [fetchUnreadCount]);

    const handledNotificationIdsRef = useRef(new Map());
    const fetchUnreadCountRef = useRef(fetchUnreadCount);
    useEffect(() => {
        fetchUnreadCountRef.current = fetchUnreadCount;
    }, [fetchUnreadCount]);

    const [kots, setKots] = useState([]);
    const [stations, setStations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [lastSyncAt, setLastSyncAt] = useState(null);

    // Filters
    const [selectedStationId, setSelectedStationId] = useState("ALL");
    const [selectedStatus, setSelectedStatus] = useState("ALL");
    const [selectedPriority, setSelectedPriority] = useState("ALL");
    const [searchQuery, setSearchQuery] = useState("");

    // Audio & Action states
    const [updatingKotId, setUpdatingKotId] = useState(null);
    const [reprintingKotId, setReprintingKotId] = useState(null);
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
                if (!next) playNotificationSound();
            } catch {}
            return next;
        });
    };

    // Timer tick to trigger live timer re-renders
    const [, setTick] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => setTick((t) => t + 1), 10000);
        return () => clearInterval(timer);
    }, []);

    // Load Stations
    const loadStations = useCallback(async () => {
        if (!restaurantId) return;
        try {
            const res = await api.get(`/owner/${restaurantId}/stations`);
            const list = Array.isArray(res?.data?.stations) ? res.data.stations : [];
            setStations(list);
        } catch (err) {
            console.error("Failed to load stations:", err);
        }
    }, [restaurantId]);

    // Load KOTs
    const loadKots = useCallback(async ({ silent = false } = {}) => {
        if (!restaurantId) return;
        if (silent) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        try {
            const res = await api.get(`/owner/${restaurantId}/kots?limit=100`);
            const list = Array.isArray(res?.data?.kots) ? res.data.kots : [];
            setKots(list);
            setError("");
            setLastSyncAt(new Date());
        } catch (err) {
            setError(err?.response?.data?.message || "Failed to load kitchen tickets.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [restaurantId]);

    useEffect(() => {
        if (!restaurantId) return;
        loadStations();
        loadKots();
    }, [loadStations, loadKots, restaurantId]);

    // Socket Event Handlers
    useEffect(() => {
        if (!socket) return undefined;

        const onKotCreated = (kot) => {
            setKots((prev) => {
                const list = Array.isArray(prev) ? prev : [];
                const id = Number(kot?.id || 0);
                if (!id) return list;
                const idx = list.findIndex((k) => Number(k?.id || 0) === id);
                if (idx === -1) return [kot, ...list];
                const copy = list.slice();
                copy[idx] = kot;
                return copy;
            });
            setLastSyncAt(new Date());

            if (!soundMuted) playNotificationSound();
            showToast({
                title: `New Ticket ${kot?.kotNo || ""}`,
                message: `Station: ${kot?.stationName || "Kitchen"} • Table: ${kot?.tableNo || "Takeaway"}`,
                variant: "info",
                durationMs: 2200,
            });
        };

        const onKotUpdated = (kot) => {
            setKots((prev) => {
                const list = Array.isArray(prev) ? prev : [];
                const id = Number(kot?.id || 0);
                if (!id) return list;
                const idx = list.findIndex((k) => Number(k?.id || 0) === id);
                if (idx === -1) return [kot, ...list];
                const copy = list.slice();
                copy[idx] = kot;
                return copy;
            });
            setLastSyncAt(new Date());
        };

        const onKotItemUpdated = ({ kot }) => {
            if (kot) onKotUpdated(kot);
        };

        const handleNewNotification = (notif) => {
            if (!notif) return;
            const notifKey = notif.id
                ? `id:${notif.id}`
                : (notif.idempotencyKey || notif.data?.idempotencyKey)
                ? `idem:${notif.idempotencyKey || notif.data?.idempotencyKey}`
                : null;

            if (notifKey) {
                const now = Date.now();
                const lastSeen = handledNotificationIdsRef.current.get(notifKey);
                if (handledNotificationIdsRef.current.size > 100) {
                    for (const [k, timestamp] of handledNotificationIdsRef.current.entries()) {
                        if (now - timestamp > 30000) {
                            handledNotificationIdsRef.current.delete(k);
                        }
                    }
                }
                if (lastSeen && now - lastSeen < 10000) {
                    return;
                }
                handledNotificationIdsRef.current.set(notifKey, now);
            }

            fetchUnreadCountRef.current?.();

            if (!soundMuted) {
                playNotificationSound();
            }

            if (notif.title || notif.message) {
                showToast({
                    title: notif.title || "New Notification",
                    message: notif.message || "",
                    variant: "info",
                    durationMs: 3000,
                });
            }
        };

        socket.on("kot_created", onKotCreated);
        socket.on("kot:status_updated", onKotUpdated);
        socket.on("kot:item_updated", onKotItemUpdated);
        socket.on("kot:priority_updated", onKotUpdated);
        socket.on("notification:new", handleNewNotification);

        return () => {
            socket.off("kot_created", onKotCreated);
            socket.off("kot:status_updated", onKotUpdated);
            socket.off("kot:item_updated", onKotItemUpdated);
            socket.off("kot:priority_updated", onKotUpdated);
            socket.off("notification:new", handleNewNotification);
        };
    }, [socket, soundMuted]);

    // Update KOT Status
    const handleUpdateKotStatus = async (kotId, status) => {
        try {
            setUpdatingKotId(kotId);
            const res = await api.put(`/owner/${restaurantId}/kots/${kotId}/status`, { status });
            if (res.data?.ok && res.data.kot) {
                setKots((prev) => prev.map((k) => (k.id === kotId ? res.data.kot : k)));
                showToast({
                    title: `Ticket ${res.data.kot.kotNo}`,
                    message: `Status updated to ${status}`,
                    variant: "success",
                    durationMs: 1800,
                });
            }
        } catch (err) {
            showToast({
                title: "Status Update Failed",
                message: err?.response?.data?.message || err?.message,
                variant: "error",
            });
        } finally {
            setUpdatingKotId(null);
        }
    };

    // Update Item-level Status
    const handleUpdateItemStatus = async (kotId, itemId, status) => {
        try {
            const res = await api.put(`/owner/${restaurantId}/kots/${kotId}/items/${itemId}/status`, { status });
            if (res.data?.ok && res.data.kot) {
                setKots((prev) => prev.map((k) => (k.id === kotId ? res.data.kot : k)));
            }
        } catch (err) {
            showToast({
                title: "Item Status Error",
                message: err?.response?.data?.message || err?.message,
                variant: "error",
            });
        }
    };

    // Update Priority
    const handleUpdatePriority = async (kotId, priority) => {
        try {
            const res = await api.put(`/owner/${restaurantId}/kots/${kotId}/priority`, { priority });
            if (res.data?.ok && res.data.kot) {
                setKots((prev) => prev.map((k) => (k.id === kotId ? res.data.kot : k)));
                showToast({
                    title: `Priority updated`,
                    message: `KOT set to ${priority}`,
                    variant: "info",
                });
            }
        } catch (err) {
            showToast({
                title: "Priority Error",
                message: err?.response?.data?.message || err?.message,
                variant: "error",
            });
        }
    };

    // Reprint KOT
    const handleReprintKot = async (kotId) => {
        try {
            setReprintingKotId(kotId);
            const res = await api.post(`/owner/${restaurantId}/kots/${kotId}/reprint`);
            if (res.data?.ok) {
                showToast({
                    title: "Reprint Dispatched",
                    message: res.data.result?.ok ? "Sent to station thermal printer" : res.data.result?.message || "Print queued",
                    variant: res.data.result?.ok ? "success" : "warning",
                });
                loadKots({ silent: true });
            }
        } catch (err) {
            showToast({
                title: "Reprint Error",
                message: err?.response?.data?.message || err?.message,
                variant: "error",
            });
        } finally {
            setReprintingKotId(null);
        }
    };

    // Filter KOTs
    const filteredKots = useMemo(() => {
        return kots.filter((kot) => {
            // Station Filter
            if (selectedStationId !== "ALL" && Number(kot.stationId) !== Number(selectedStationId)) {
                return false;
            }
            // Status Filter
            if (selectedStatus !== "ALL" && String(kot.status).toUpperCase() !== selectedStatus) {
                return false;
            }
            // Priority Filter
            if (selectedPriority !== "ALL" && String(kot.priority || "NORMAL").toUpperCase() !== selectedPriority) {
                return false;
            }
            // Search Query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const kotNo = String(kot.kotNo || "").toLowerCase();
                const tableNo = String(kot.tableNo || "").toLowerCase();
                const orderNo = String(kot.order?.orderNo || "").toLowerCase();
                const waiter = String(kot.waiterName || "").toLowerCase();
                const itemMatch = Array.isArray(kot.items) && kot.items.some((it) => String(it.itemName).toLowerCase().includes(q));
                if (!kotNo.includes(q) && !tableNo.includes(q) && !orderNo.includes(q) && !waiter.includes(q) && !itemMatch) {
                    return false;
                }
            }
            return true;
        });
    }, [kots, selectedStationId, selectedStatus, selectedPriority, searchQuery]);

    // Grouping KOTs by status column
    const groupedKots = useMemo(() => {
        const groups = {
            NEW: [],
            PREPARING: [],
            READY: [],
        };

        filteredKots.forEach((kot) => {
            const st = String(kot.status || "PENDING").toUpperCase();
            if (st === "PENDING" || st === "ACCEPTED" || st === "PRINTED" || st === "PRINT_FAILED") {
                groups.NEW.push(kot);
            } else if (st === "PREPARING") {
                groups.PREPARING.push(kot);
            } else if (st === "READY") {
                groups.READY.push(kot);
            }
        });

        return groups;
    }, [filteredKots]);

    // Workload Metrics
    const metrics = useMemo(() => {
        const activeKots = kots.filter((k) => k.status !== "SERVED" && k.status !== "CANCELLED");
        const newCount = activeKots.filter((k) => ["PENDING", "ACCEPTED", "PRINTED", "PRINT_FAILED"].includes(k.status)).length;
        const prepCount = activeKots.filter((k) => k.status === "PREPARING").length;
        const readyCount = activeKots.filter((k) => k.status === "READY").length;
        const urgentCount = activeKots.filter((k) => k.priority === "URGENT" || k.priority === "HIGH").length;

        let overdueCount = 0;
        let totalElapsed = 0;
        activeKots.forEach((k) => {
            const sla = getSlaStatus(k.createdAt, k.estimatedPrepTimeMinutes);
            if (k.status !== "READY" && sla.label === "OVERDUE") overdueCount++;
            totalElapsed += sla.elapsed;
        });

        const avgPrepMins = activeKots.length > 0 ? Math.round(totalElapsed / activeKots.length) : 0;

        return {
            totalActive: activeKots.length,
            newCount,
            prepCount,
            readyCount,
            urgentCount,
            overdueCount,
            avgPrepMins,
        };
    }, [kots]);

    return (
        <div className="min-h-screen bg-slate-50/40 text-slate-900 font-sans">
            {/* Top Bar Header */}
            <header className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <ChefHat className="text-orange-500" size={22} />
                            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{titleLabel}</h1>
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">
                                {restaurantName}
                            </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                            Multi-station order routing · Real-time preparation SLAs · Kitchen Display System
                        </p>
                    </div>

                    {/* Workload Metric Chips & Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
                            <span className="text-slate-500 font-medium">NEW:</span>
                            <strong className="text-slate-900 font-bold">{metrics.newCount}</strong>
                            <span className="text-slate-300">|</span>
                            <span className="text-slate-500 font-medium">PREP:</span>
                            <strong className="text-orange-600 font-bold">{metrics.prepCount}</strong>
                            <span className="text-slate-300">|</span>
                            <span className="text-slate-500 font-medium">READY:</span>
                            <strong className="text-emerald-600 font-bold">{metrics.readyCount}</strong>
                            <span className="text-slate-300">|</span>
                            <span className="text-slate-500 font-medium">OVERDUE:</span>
                            <strong className={`font-bold ${metrics.overdueCount > 0 ? "text-red-600 font-extrabold" : "text-slate-900"}`}>{metrics.overdueCount}</strong>
                        </div>

                        <button
                            type="button"
                            onClick={() => loadKots({ silent: true })}
                            disabled={refreshing}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition shadow-sm"
                        >
                            <RefreshCw size={13} className={refreshing ? "animate-spin text-orange-500" : "text-slate-500"} />
                            Refresh
                        </button>

                        <button
                            type="button"
                            onClick={() => setSoundModalOpen(true)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
                        >
                            {soundMuted ? <BellOff size={13} className="text-slate-400" /> : <Bell size={13} className="text-orange-500" />}
                            {soundMuted ? "Muted" : "Alert On"}
                        </button>

                        <Link
                            to="/owner"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
                        >
                            Dashboard
                        </Link>

                        {/* Notifications Button */}
                        <button
                            type="button"
                            onClick={() => {
                                if (viewMode === "NOTIFICATIONS") {
                                    setViewMode("KDS");
                                    navigate("/kitchen");
                                } else {
                                    setViewMode("NOTIFICATIONS");
                                    navigate("/kitchen/notifications");
                                }
                            }}
                            className={`relative flex items-center gap-1.5 rounded-xl border px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold transition cursor-pointer whitespace-nowrap shadow-xs ${
                                viewMode === "NOTIFICATIONS"
                                    ? "border-orange-500 bg-orange-500 text-white"
                                    : "border-[color:var(--app-border)]/40 bg-white/60 dark:bg-slate-900/60 theme-muted hover:text-[color:var(--app-text)]"
                            }`}
                            title="Kitchen Notifications"
                        >
                            <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            <span className="hidden min-[500px]:inline">Notifications</span>
                            {unreadNotificationCount > 0 && (
                                <span className="rounded-full bg-rose-500 text-white px-1.5 py-0.2 text-[9px] sm:text-[10px] font-black animate-pulse">
                                    {unreadNotificationCount}
                                </span>
                            )}
                        </button>

                        {/* Profile Button */}
                        <button
                            type="button"
                            onClick={() => {
                                if (viewMode === "PROFILE") {
                                    setViewMode("KDS");
                                    navigate("/kitchen");
                                } else {
                                    setViewMode("PROFILE");
                                    navigate("/kitchen/profile");
                                }
                            }}
                            className={`flex items-center gap-1.5 rounded-xl border px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold transition cursor-pointer whitespace-nowrap shadow-xs ${
                                viewMode === "PROFILE"
                                    ? "border-orange-500 bg-orange-500 text-white"
                                    : "border-[color:var(--app-border)]/40 bg-white/60 dark:bg-slate-900/60 theme-muted hover:text-[color:var(--app-text)]"
                            }`}
                            title="My Profile"
                        >
                            <div className={`h-5 w-5 rounded-full flex items-center justify-center font-black text-[10px] ${
                                viewMode === "PROFILE" ? "bg-white text-orange-600" : "bg-orange-500 text-white"
                            }`}>
                                {(user?.name || user?.username || "C").charAt(0).toUpperCase()}
                            </div>
                            <span className="hidden sm:inline font-bold">{user?.name?.split(" ")[0] || "Profile"}</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content Body */}
            {viewMode === "PROFILE" ? (
                <div className="flex-1 p-3 sm:p-4 max-w-7xl mx-auto w-full">
                    <ServerProfileView
                        onBackToFloorPlan={() => {
                            setViewMode("KDS");
                            navigate("/kitchen");
                        }}
                        onBack={() => {
                            setViewMode("KDS");
                            navigate("/kitchen");
                        }}
                        backLabel="Kitchen"
                        title="Kitchen Profile"
                    />
                </div>
            ) : viewMode === "NOTIFICATIONS" ? (
                <div className="flex-1 p-3 sm:p-4 max-w-7xl mx-auto w-full">
                    <ServerNotificationsView
                        onUnreadCountChange={setUnreadNotificationCount}
                        onNavigateToTable={(tableNo) => {
                            setViewMode("KDS");
                            navigate("/kitchen");
                            if (tableNo) setSearchQuery(String(tableNo));
                        }}
                        onBackToFloorPlan={() => {
                            setViewMode("KDS");
                            navigate("/kitchen");
                        }}
                        onBack={() => {
                            setViewMode("KDS");
                            navigate("/kitchen");
                        }}
                        backLabel="Kitchen"
                    />
                </div>
            ) : (
                <>
            {/* Station Filter Tabs */}
            <div className="border-b border-slate-200 bg-white px-4 py-2 sm:px-6">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 pr-1 flex items-center gap-1">
                        <Flame size={14} className="text-orange-500" /> Stations:
                    </span>
                    <button
                        type="button"
                        onClick={() => setSelectedStationId("ALL")}
                        className={`rounded-lg px-3 py-1 text-xs font-semibold transition shrink-0 ${
                            selectedStationId === "ALL"
                                ? "bg-orange-500 text-white shadow-sm"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900"
                        }`}
                    >
                        ALL STATIONS ({kots.length})
                    </button>

                    {stations.map((st) => {
                        const count = kots.filter((k) => Number(k.stationId) === Number(st.id)).length;
                        return (
                            <button
                                key={st.id}
                                type="button"
                                onClick={() => setSelectedStationId(String(st.id))}
                                className={`rounded-lg px-3 py-1 text-xs font-semibold transition shrink-0 ${
                                    selectedStationId === String(st.id)
                                        ? "bg-orange-500 text-white shadow-sm"
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900"
                                }`}
                            >
                                {st.name} ({count})
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Filter Bar & Search */}
            <div className="border-b border-slate-200 bg-white px-4 py-2.5 sm:px-6">
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <div className="flex items-center gap-1 text-slate-500 font-semibold">
                            <Filter size={13} /> Priority:
                        </div>
                        <div className="inline-flex items-center rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                            {PRIORITIES.map((prio) => (
                                <button
                                    key={prio}
                                    type="button"
                                    onClick={() => setSelectedPriority(prio)}
                                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                                        selectedPriority === prio
                                            ? "bg-orange-500 text-white shadow-sm"
                                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                                    }`}
                                >
                                    {prio}
                                </button>
                            ))}
                        </div>

                        <span className="text-slate-300">|</span>

                        <div className="flex items-center gap-1 text-slate-500 font-semibold">
                            Status:
                        </div>
                        <div className="inline-flex items-center rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                            {KOT_STATUSES.map((st) => (
                                <button
                                    key={st}
                                    type="button"
                                    onClick={() => setSelectedStatus(st)}
                                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                                        selectedStatus === st
                                            ? "bg-orange-500 text-white shadow-sm"
                                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                                    }`}
                                >
                                    {st}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Instant Search Input */}
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 shadow-sm sm:w-64 focus-within:border-orange-500 focus-within:ring-1 focus-within:ring-orange-500">
                        <Search size={14} className="text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search KOT#, Table#, Order#..."
                            className="w-full bg-transparent text-xs text-slate-900 placeholder-slate-400 outline-none"
                        />
                        {searchQuery && (
                            <button type="button" onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-600">
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Main KDS Columns View */}
            <main className="p-4 sm:p-6">
                {error && (
                    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center gap-2 py-20 text-slate-500 text-sm">
                        <LoaderCircle size={20} className="animate-spin text-orange-500" />
                        Loading Kitchen Display System...
                    </div>
                ) : filteredKots.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-white py-16 text-slate-500 shadow-sm">
                        <UtensilsCrossed size={32} className="text-slate-400" />
                        <p className="text-sm font-semibold text-slate-700">No active kitchen tickets in this view</p>
                        <p className="text-xs text-slate-400">Incoming tickets will split to station queues in real time.</p>
                    </div>
                ) : (
                    <div className="grid gap-6 lg:grid-cols-3 items-start">
                        {/* COLUMN 1: NEW / PENDING */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                <div className="flex items-center gap-2">
                                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                                    <h2 className="font-bold text-xs uppercase tracking-wider text-slate-800">NEW ORDERS</h2>
                                </div>
                                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 border border-amber-200">
                                    {groupedKots.NEW.length}
                                </span>
                            </div>

                            <div className="space-y-3">
                                {groupedKots.NEW.map((kot) => (
                                    <KotCard
                                        key={kot.id}
                                        kot={kot}
                                        updatingKotId={updatingKotId}
                                        reprintingKotId={reprintingKotId}
                                        onUpdateKotStatus={handleUpdateKotStatus}
                                        onUpdateItemStatus={handleUpdateItemStatus}
                                        onUpdatePriority={handleUpdatePriority}
                                        onReprintKot={handleReprintKot}
                                    />
                                ))}
                                {groupedKots.NEW.length === 0 && (
                                    <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center text-xs text-slate-400 italic">
                                        No new tickets waiting
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* COLUMN 2: PREPARING */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                <div className="flex items-center gap-2">
                                    <Flame size={14} className="text-orange-500" />
                                    <h2 className="font-bold text-xs uppercase tracking-wider text-slate-800">PREPARING</h2>
                                </div>
                                <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-bold text-orange-700 border border-orange-200">
                                    {groupedKots.PREPARING.length}
                                </span>
                            </div>

                            <div className="space-y-3">
                                {groupedKots.PREPARING.map((kot) => (
                                    <KotCard
                                        key={kot.id}
                                        kot={kot}
                                        updatingKotId={updatingKotId}
                                        reprintingKotId={reprintingKotId}
                                        onUpdateKotStatus={handleUpdateKotStatus}
                                        onUpdateItemStatus={handleUpdateItemStatus}
                                        onUpdatePriority={handleUpdatePriority}
                                        onReprintKot={handleReprintKot}
                                    />
                                ))}
                                {groupedKots.PREPARING.length === 0 && (
                                    <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center text-xs text-slate-400 italic">
                                        No tickets in preparation
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* COLUMN 3: READY */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 size={14} className="text-emerald-600" />
                                    <h2 className="font-bold text-xs uppercase tracking-wider text-slate-800">READY FOR PASS</h2>
                                </div>
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                                    {groupedKots.READY.length}
                                </span>
                            </div>

                            <div className="space-y-3">
                                {groupedKots.READY.map((kot) => (
                                    <KotCard
                                        key={kot.id}
                                        kot={kot}
                                        updatingKotId={updatingKotId}
                                        reprintingKotId={reprintingKotId}
                                        onUpdateKotStatus={handleUpdateKotStatus}
                                        onUpdateItemStatus={handleUpdateItemStatus}
                                        onUpdatePriority={handleUpdatePriority}
                                        onReprintKot={handleReprintKot}
                                    />
                                ))}
                                {groupedKots.READY.length === 0 && (
                                    <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center text-xs text-slate-400 italic">
                                        No tickets marked ready
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </main>
                </>
            )}

            {/* Sound Notification Modal */}
            {soundModalOpen ? (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-sm"
                    onClick={() => setSoundModalOpen(false)}
                    role="presentation"
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                                    <Bell size={20} />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900">Kitchen Order Audio Alerts</h3>
                                    <p className="text-xs text-slate-500">Sound notification setup for new incoming tickets</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSoundModalOpen(false)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-4">
                            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex items-center gap-3">
                                    {soundMuted ? <VolumeX size={20} className="text-slate-400" /> : <Volume2 size={20} className="text-orange-600" />}
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">{soundMuted ? "Audio Chime Muted" : "Audio Chime Active"}</p>
                                        <p className="text-xs text-slate-500">Plays automatically when KOT arrives</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={toggleSoundMute}
                                    className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
                                        soundMuted
                                            ? "bg-orange-500 text-white hover:bg-orange-600 shadow-sm"
                                            : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                    }`}
                                >
                                    {soundMuted ? "Unmute" : "Mute"}
                                </button>
                            </div>

                            <NotificationSoundPicker />
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

/**
 * Individual KOT Card Component
 */
function KotCard({
    kot,
    updatingKotId,
    reprintingKotId,
    onUpdateKotStatus,
    onUpdateItemStatus,
    onUpdatePriority,
    onReprintKot,
}) {
    const sla = getSlaStatus(kot.createdAt, kot.estimatedPrepTimeMinutes);
    const orderSource = kot.order?.orderSource || "POS";
    const items = Array.isArray(kot.items) ? kot.items : [];
    const isUrgent = kot.priority === "URGENT";

    return (
        <article
            className={`relative rounded-xl border transition-all shadow-sm ${
                isUrgent
                    ? "border-red-300 bg-red-50/20 ring-1 ring-red-200"
                    : "border-slate-200 bg-white hover:border-slate-300"
            }`}
        >
            {/* Header: Ticket No, Station, Priority, Source */}
            <div className="border-b border-slate-100 p-3.5 pb-2.5">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-base font-bold text-slate-900">{kot.kotNo}</span>
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${sourceBadgeClass(orderSource)}`}>
                                {orderSource}
                            </span>
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${priorityBadgeClass(kot.priority)}`}>
                                {kot.priority || "NORMAL"}
                            </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600 font-medium">
                            Station: <strong className="text-slate-900">{kot.stationName || "MAIN KITCHEN"}</strong>
                            {kot.tableNo ? ` • Table ${kot.tableNo}` : " • Takeaway"}
                        </p>
                    </div>

                    {/* SLA Prep Timer Badge */}
                    <div className="text-right">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${sla.badgeClass}`}>
                            <Clock3 size={11} />
                            {sla.label} ({sla.elapsed}m / {kot.estimatedPrepTimeMinutes || 15}m)
                        </span>
                        <p className="mt-1 text-[10px] text-slate-400">
                            {new Date(kot.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                    </div>
                </div>

                {kot.reprintCount > 0 && (
                    <div className="mt-2 text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                        *** REPRINT #{kot.reprintCount} ***
                    </div>
                )}
            </div>

            {/* Items Checklist - minimal horizontal rows, no heavy nested card boxes */}
            <div className="divide-y divide-slate-100 px-3.5 py-1">
                {items.map((it) => {
                    const isCancelled = it.status === "CANCELLED";
                    const isReady = it.status === "READY";
                    const isPrep = it.status === "PREPARING";

                    return (
                        <div
                            key={it.id}
                            className={`py-2 transition text-xs flex items-start justify-between gap-2 ${
                                isCancelled ? "opacity-50" : ""
                            }`}
                        >
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5 text-sm">
                                    <span className="text-orange-600 font-bold">{it.qty}×</span>
                                    <span className={`text-slate-900 font-medium ${isCancelled ? "line-through text-slate-400" : ""}`}>
                                        {it.itemName}
                                    </span>
                                </div>

                                {it.variantName && (
                                    <div className="text-[11px] text-slate-500">
                                        Variant: <span className="text-slate-700 font-medium">{it.variantName}</span>
                                    </div>
                                )}

                                {Array.isArray(it.selectedModifiers) && it.selectedModifiers.length > 0 && (
                                    <div className="text-[11px] text-slate-500 space-y-0.5 pl-2 border-l border-slate-200">
                                        {it.selectedModifiers.map((mod, idx) => (
                                            <div key={idx}>+ {typeof mod === "string" ? mod : mod.name || mod.modifierName}</div>
                                        ))}
                                    </div>
                                )}

                                {it.notes && (
                                    <div className="text-[11px] text-amber-700 font-medium italic">
                                        Note: {it.notes}
                                    </div>
                                )}
                            </div>

                            {/* Item Status Toggle Action */}
                            <button
                                type="button"
                                disabled={isCancelled}
                                onClick={() => {
                                    const next = isPrep ? "READY" : isReady ? "PENDING" : "PREPARING";
                                    onUpdateItemStatus(kot.id, it.id, next);
                                }}
                                className={`rounded-md px-2 py-0.5 text-[11px] font-bold transition shrink-0 ${
                                    isCancelled
                                        ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                                        : isReady
                                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                                        : isPrep
                                        ? "bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200"
                                        : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                                }`}
                            >
                                {it.status || "PENDING"}
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Bottom Actions Bar */}
            <div className="border-t border-slate-100 p-3 bg-slate-50/70 rounded-b-xl space-y-2">
                <div className="flex items-center justify-between gap-2">
                    {/* Status Transition Action Buttons */}
                    {kot.status !== "READY" && (
                        <button
                            type="button"
                            disabled={updatingKotId === kot.id}
                            onClick={() => {
                                const next = kot.status === "PREPARING" ? "READY" : "PREPARING";
                                onUpdateKotStatus(kot.id, next);
                            }}
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-xs font-bold text-white hover:bg-orange-600 transition shadow-sm disabled:opacity-50"
                        >
                            {updatingKotId === kot.id ? (
                                <LoaderCircle size={14} className="animate-spin" />
                            ) : kot.status === "PREPARING" ? (
                                <>
                                    <CheckCircle2 size={14} /> MARK ALL READY
                                </>
                            ) : (
                                <>
                                    <Flame size={14} /> START PREPARING
                                </>
                            )}
                        </button>
                    )}

                    {kot.status === "READY" && (
                        <button
                            type="button"
                            disabled={updatingKotId === kot.id}
                            onClick={() => onUpdateKotStatus(kot.id, "SERVED")}
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-sm disabled:opacity-50"
                        >
                            {updatingKotId === kot.id ? <LoaderCircle size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                            SERVE / PASS
                        </button>
                    )}

                    {/* Reprint Action */}
                    <button
                        type="button"
                        disabled={reprintingKotId === kot.id}
                        onClick={() => onReprintKot(kot.id)}
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
                        title="Reprint KOT Ticket"
                    >
                        {reprintingKotId === kot.id ? <LoaderCircle size={13} className="animate-spin text-orange-500" /> : <Printer size={13} className="text-slate-500" />}
                        Print
                    </button>
                </div>

                {/* Priority Selector Dropdown */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                    <span>Change Priority:</span>
                    <div className="flex items-center gap-1">
                        {["NORMAL", "HIGH", "URGENT"].map((prio) => (
                            <button
                                key={prio}
                                type="button"
                                onClick={() => onUpdatePriority(kot.id, prio)}
                                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition ${
                                    kot.priority === prio
                                        ? "bg-orange-500 text-white shadow-sm"
                                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                                }`}
                            >
                                {prio}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </article>
    );
}
