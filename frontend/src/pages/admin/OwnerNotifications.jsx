import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
    Bell,
    Check,
    CheckCheck,
    Clock,
    Filter,
    RefreshCw,
    Search,
} from "lucide-react";
import axios from "axios";
import { API } from "../../config";
import { api } from "../../utils/apiClient";
import { getActiveStaffToken } from "../../utils/staffSessionStorage";
import { useStaffSocket } from "../../context/StaffSocketContext";
import { useAuth } from "../../context/AuthContext";
import { playNotificationSound } from "../../utils/soundPlayer";
import {
    getOwnerNotifications,
    markAllOwnerNotificationsRead,
    markOwnerNotificationRead,
    subscribeOwnerNotifications,
    appendOwnerNotification,
} from "../../utils/ownerNotifications";
import OwnerMenuButton from "../../components/OwnerMenuButton";

const formatTime = (value) => {
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return "Just now";
    return dt.toLocaleString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
    });
};

export default function OwnerNotifications() {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [filterType, setFilterType] = useState("ALL"); // ALL | UNREAD | ORDERS | TABLES | SUCCESS | INFO
    const [searchQuery, setSearchQuery] = useState("");
    const { socket } = useStaffSocket?.() || {};
    const outletCtx = typeof useOutletContext === "function" ? useOutletContext() : null;
    const { user } = useAuth?.() || {};
    const restaurantId = Number(outletCtx?.restaurantId || user?.restaurantId || user?.restaurant?.id || 0) || null;

    const unreadCount = useMemo(
        () => notifications.reduce((sum, item) => sum + (item.read ? 0 : 1), 0),
        [notifications]
    );

    const fetchBackendNotifications = useCallback(async (isRefresh = false) => {
        const token = getActiveStaffToken() || localStorage.getItem("token") || localStorage.getItem("staffToken") || sessionStorage.getItem("token");
        if (!token) {
            setNotifications([]);
            return;
        }

        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            const res = await api.get("/api/notifications", {
                params: { page: 1, limit: 100, ...(restaurantId ? { restaurantId } : {}) },
                headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    ...(restaurantId ? { "x-restaurant-id": String(restaurantId) } : {}),
                },
            });
            const list = res.data?.notifications || res.data?.data || [];
            if (Array.isArray(list)) {
                const mapped = list.map((item) => ({
                    id: item.id,
                    title: item.title || item.data?.title || item.notificationType || "Notification",
                    message: item.message || item.data?.message || "",
                    type: item.notificationType || item.type || "INFO",
                    createdAt: item.createdAt,
                    read: Boolean(item.isRead || item.read),
                    data: item.data,
                }));
                setNotifications(mapped);
            }
        } catch (err) {
            console.warn("[OwnerNotifications] Backend fetch error:", err?.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [restaurantId]);

    useEffect(() => {
        fetchBackendNotifications();
    }, [fetchBackendNotifications]);

    // Cross-component state sync: refresh when background updates arrive
    useEffect(() => {
        const handleSync = (e) => {
            if (e?.detail?.source !== "OwnerNotifications") {
                fetchBackendNotifications(true);
            }
        };
        window.addEventListener("notifications:updated", handleSync);
        return () => {
            window.removeEventListener("notifications:updated", handleSync);
        };
    }, [fetchBackendNotifications]);

    // Realtime notification socket listener
    useEffect(() => {
        if (!socket) return;

        const handleNewNotification = (notif) => {
            if (!notif) return;
            const mapped = {
                id: notif.id || `notif_${Date.now()}`,
                title: notif.title || notif.data?.title || notif.notificationType || "Notification",
                message: notif.message || notif.data?.message || "",
                type: notif.notificationType || notif.type || "INFO",
                createdAt: notif.createdAt || new Date().toISOString(),
                read: false,
                data: notif.data,
            };

            setNotifications((prev) => {
                if (prev.some((p) => p.id === mapped.id)) return prev;
                return [mapped, ...prev];
            });

            appendOwnerNotification(notif);
            Promise.resolve(playNotificationSound?.("default")).catch(() => {});
            window.dispatchEvent(new CustomEvent("notifications:updated", { detail: { source: "OwnerNotifications" } }));
        };

        const handleRefetch = () => {
            fetchBackendNotifications(true);
        };

        socket.on("notification:new", handleNewNotification);
        socket.on("food:delivered", handleRefetch);
        socket.on("order:updated", handleRefetch);
        socket.on("order:status_updated", handleRefetch);
        socket.on("kot:status_updated", handleRefetch);

        return () => {
            socket.off("notification:new", handleNewNotification);
            socket.off("food:delivered", handleRefetch);
            socket.off("order:updated", handleRefetch);
            socket.off("order:status_updated", handleRefetch);
            socket.off("kot:status_updated", handleRefetch);
        };
    }, [socket, fetchBackendNotifications]);

    const onMarkAllRead = async () => {
        setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
        markAllOwnerNotificationsRead();
        window.dispatchEvent(new CustomEvent("notifications:updated"));

        try {
            await api.patch("/api/notifications/read-all", {});
        } catch {
            try {
                await api.put("/api/notifications/read-all", {});
            } catch (_) {}
        }
    };

    const onMarkOneRead = async (id) => {
        setNotifications((prev) =>
            prev.map((item) => (item.id === id ? { ...item, read: true } : item))
        );
        markOwnerNotificationRead(id);
        window.dispatchEvent(new CustomEvent("notifications:updated"));

        if (id && !String(id).startsWith("seed_")) {
            try {
                await api.patch(`/api/notifications/${id}/read`, {});
            } catch {
                try {
                    await api.put(`/api/notifications/${id}/read`, {});
                } catch (_) {}
            }
        }
    };

    // Filter & Search Notifications
    const filteredNotifications = useMemo(() => {
        return notifications.filter((item) => {
            const isUnread = !item.read;
            const typeUpper = String(item.type || "").toUpperCase();

            // Type / Unread filter
            if (filterType === "UNREAD" && !isUnread) return false;
            if (filterType === "ORDERS" && !typeUpper.includes("ORDER") && !typeUpper.includes("DELIVER") && !typeUpper.includes("FOOD") && !typeUpper.includes("KOT")) return false;
            if (filterType === "TABLES" && !typeUpper.includes("TABLE") && !typeUpper.includes("WAITER") && !typeUpper.includes("BILL")) return false;
            if (filterType === "SUCCESS" && !["SUCCESS", "PAYMENT", "DELIVERED", "SERVED", "CLEANED", "ACCEPTED", "COMPLETED"].some((t) => typeUpper.includes(t))) return false;
            if (filterType === "INFO" && !["INFO", "SYSTEM", "TASK", "ALERT", "STOCK", "EXPIRY", "BATCH", "GRN", "BARGAIN", "WASTAGE", "SECURITY"].some((t) => typeUpper.includes(t)) && (typeUpper.includes("ORDER") || typeUpper.includes("TABLE") || typeUpper.includes("WAITER") || typeUpper.includes("BILL") || typeUpper.includes("FOOD") || typeUpper.includes("KOT"))) return false;

            // Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const titleMatch = String(item.title || "").toLowerCase().includes(q);
                const msgMatch = String(item.message || "").toLowerCase().includes(q);
                const typeMatch = String(item.type || "").toLowerCase().includes(q);
                return titleMatch || msgMatch || typeMatch;
            }

            return true;
        });
    }, [notifications, filterType, searchQuery]);

    return (
        <div className="min-h-screen bg-[color:var(--app-bg,#f8fafc)] text-[color:var(--app-text,#0f172a)] p-3 space-y-3">
            {/* Header Bar - Compact */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[color:var(--app-border)]/40 pb-2.5">
                <div className="flex items-center gap-2">
                    <OwnerMenuButton />
                    <div className="rounded-xl bg-orange-500/10 p-1.5 text-orange-500 border border-orange-500/20">
                        <Bell className="h-4 w-4" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold tracking-tight text-[color:var(--app-text)] flex items-center gap-2">
                            Notifications Log
                            <span className="rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/20 px-2 py-0.2 text-[10px] font-extrabold">
                                {unreadCount} UNREAD
                            </span>
                        </h1>
                        <p className="text-[11px] theme-muted">
                            Real-time operational activity alerts and system updates.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => fetchBackendNotifications(true)}
                        disabled={refreshing}
                        className="rounded-lg border border-[color:var(--app-border)]/60 bg-black/5 dark:bg-white/5 p-1.5 text-xs text-[color:var(--app-text)] hover:bg-black/10 dark:hover:bg-white/10 transition"
                        title="Refresh notifications"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-orange-500" : ""}`} />
                    </button>
                    <button
                        type="button"
                        onClick={onMarkAllRead}
                        disabled={unreadCount === 0}
                        className="rounded-lg bg-orange-500 px-3 py-1 text-xs font-bold text-white shadow-sm hover:bg-orange-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Mark all as read
                    </button>
                </div>
            </div>

            {/* Filter & Search Bar - Borderless "Words on Paper" */}
            <div className="flex flex-wrap items-center justify-between gap-2 py-1 text-xs">
                {/* Filter Quick Tabs */}
                <div className="flex items-center gap-1 overflow-x-auto py-0.5 text-[11px]">
                    {["ALL", "UNREAD", "ORDERS", "TABLES", "SUCCESS", "INFO"].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setFilterType(tab)}
                            className={`rounded-lg px-3 py-1 font-bold transition ${
                                filterType === tab
                                    ? "bg-orange-500 text-white shadow-sm"
                                    : "theme-muted hover:text-[color:var(--app-text)] hover:bg-black/5 dark:hover:bg-white/5"
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Search Bar */}
                <div className="relative w-full md:w-56">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 theme-muted" />
                    <input
                        type="text"
                        placeholder="Search notifications..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-lg border-0 bg-black/5 dark:bg-white/5 pl-8 pr-3 py-1.5 text-xs text-[color:var(--app-text)] outline-none focus:ring-1 focus:ring-orange-500 transition"
                    />
                </div>
            </div>

            {/* Notifications List - Borderless "Words on Paper" */}
            {filteredNotifications.length === 0 ? (
                <div className="py-12 text-center theme-muted space-y-1.5">
                    <Bell className="h-6 w-6 mx-auto opacity-40" />
                    <p className="font-bold text-xs">No notifications found.</p>
                </div>
            ) : (
                <div className="space-y-0.5">
                    {filteredNotifications.map((item) => {
                        const isUnread = !item.read;
                        const typeUpper = String(item.type || "INFO").toUpperCase();
                        const isSuccess = typeUpper.includes("SUCCESS") || typeUpper.includes("CLEANED") || typeUpper.includes("DELIVER") || typeUpper.includes("SERVED");
                        const isOrder = (typeUpper.includes("ORDER") || typeUpper.includes("BILL")) && !isSuccess;
                        const isTable = typeUpper.includes("TABLE") || typeUpper.includes("CLEAN");
                        const tableNo = item.data?.tableNo || item.data?.table_number || item.metadata?.tableNo;

                        return (
                            <div
                                key={item.id}
                                className={`flex items-start justify-between gap-3 px-3 py-2.5 rounded-xl transition hover:bg-black/5 dark:hover:bg-white/5 ${
                                    isUnread ? "bg-orange-500/5 dark:bg-orange-950/20" : ""
                                }`}
                            >
                                <div className="min-w-0 flex-1 space-y-0.5">
                                    {/* Line 1: Title, Type Badge, New Indicator */}
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        {isUnread && (
                                            <span className="h-1.5 w-1.5 rounded-full bg-orange-500 flex-shrink-0" title="Unread" />
                                        )}
                                        <h4 className={`text-xs ${isUnread ? "font-extrabold text-[color:var(--app-text)]" : "font-semibold text-[color:var(--app-text)]/90"}`}>
                                            {item.title}
                                        </h4>
                                        <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                            isSuccess ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" :
                                            isOrder ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" :
                                            isTable ? "bg-purple-500/15 text-purple-600 dark:text-purple-400" :
                                            "bg-sky-500/15 text-sky-600 dark:text-sky-400"
                                        }`}>
                                            {item.type}
                                        </span>
                                        {tableNo && (
                                            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400">
                                                Table {tableNo}
                                            </span>
                                        )}
                                    </div>

                                    {/* Line 2: Message Content */}
                                    <p className="text-[11px] theme-muted leading-relaxed">
                                        {item.message}
                                    </p>
                                </div>

                                {/* Right Column: Time & Mark Read Action */}
                                <div className="flex items-center gap-2 flex-shrink-0 text-[10px] theme-muted pt-0.5">
                                    <span className="flex items-center gap-1 whitespace-nowrap">
                                        <Clock className="h-3 w-3 opacity-60" />
                                        {formatTime(item.createdAt)}
                                    </span>

                                    {isUnread ? (
                                        <button
                                            type="button"
                                            onClick={() => onMarkOneRead(item.id)}
                                            className="rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 px-2 py-0.5 font-bold hover:bg-orange-500 hover:text-white transition flex items-center gap-0.5"
                                            title="Mark Read"
                                        >
                                            <Check className="h-3 w-3" />
                                            Read
                                        </button>
                                    ) : (
                                        <span className="text-emerald-500 flex items-center gap-0.5 font-medium">
                                            <CheckCheck className="h-3 w-3" />
                                            Read
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
