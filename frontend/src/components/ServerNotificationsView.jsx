import { useEffect, useMemo, useState, useCallback } from "react";
import {
    ArrowLeft,
    Bell,
    Check,
    CheckCheck,
    ChefHat,
    Clock,
    Filter,
    LoaderCircle,
    RefreshCw,
    Search,
    ShoppingBag,
    UtensilsCrossed,
} from "lucide-react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useStaffSocket } from "../context/StaffSocketContext";
import { API } from "../config";
import { showToast } from "../utils/toast";

export default function ServerNotificationsView({ onBackToFloorPlan, onSelectTable }) {
    const { user, token } = useAuth();
    const { socket } = useStaffSocket();

    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filterType, setFilterType] = useState("ALL"); // ALL | UNREAD | ORDERS | KITCHEN
    const [searchQuery, setSearchQuery] = useState("");
    const [unreadCount, setUnreadCount] = useState(0);

    const authHeaders = useMemo(() => {
        return token ? { Authorization: `Bearer ${token}` } : {};
    }, [token]);

    // Fetch Notifications from API
    const fetchNotifications = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        else setRefreshing(true);

        try {
            const res = await axios.get(`${API}/api/notifications?limit=50`, {
                headers: authHeaders,
                withCredentials: true,
            });

            if (res.data) {
                const list = Array.isArray(res.data.notifications)
                    ? res.data.notifications
                    : Array.isArray(res.data)
                    ? res.data
                    : [];
                setNotifications(list);
                setUnreadCount(res.data.unreadCount ?? list.filter((it) => !it.isRead && !it.read).length);
            }
        } catch (err) {
            console.error("Failed to fetch notifications:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [authHeaders]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    // Real-time Socket.IO Listener for instant new notifications
    useEffect(() => {
        if (!socket) return undefined;

        const handleNewNotification = (notification) => {
            if (!notification) return;
            setNotifications((prev) => {
                const exists = prev.some((n) => String(n.id) === String(notification.id));
                if (exists) return prev;
                return [notification, ...prev];
            });
            setUnreadCount((prev) => prev + 1);
        };

        socket.on("notification:new", handleNewNotification);
        socket.on("table:waiter_assigned", () => fetchNotifications(true));
        socket.on("order:created", () => fetchNotifications(true));
        socket.on("kot:status_updated", () => fetchNotifications(true));

        return () => {
            socket.off("notification:new", handleNewNotification);
            socket.off("table:waiter_assigned");
            socket.off("order:created");
            socket.off("kot:status_updated");
        };
    }, [socket, fetchNotifications]);

    // Mark Single Notification as Read
    const handleMarkSingleRead = async (notificationId) => {
        try {
            setNotifications((prev) =>
                prev.map((n) => (String(n.id) === String(notificationId) ? { ...n, isRead: true, read: true } : n))
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));

            await axios.patch(`${API}/api/notifications/${notificationId}/read`, {}, {
                headers: authHeaders,
                withCredentials: true,
            });
        } catch (err) {
            console.error("Failed to mark notification read:", err);
        }
    };

    // Mark All Notifications as Read
    const handleMarkAllRead = async () => {
        try {
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, read: true })));
            setUnreadCount(0);

            await axios.patch(`${API}/api/notifications/read-all`, {}, {
                headers: authHeaders,
                withCredentials: true,
            });

            showToast({
                title: "Notifications Read ✅",
                message: "All notifications marked as read.",
                variant: "success",
            });
        } catch (err) {
            console.error("Failed to mark all read:", err);
        }
    };

    // Filter Notifications
    const filteredNotifications = useMemo(() => {
        return notifications.filter((item) => {
            const isRead = Boolean(item.isRead || item.read);
            const typeUpper = String(item.notificationType || item.type || "").toUpperCase();

            // Filter Type
            if (filterType === "UNREAD" && isRead) return false;
            if (filterType === "ORDERS" && !typeUpper.includes("ORDER")) return false;
            if (filterType === "KITCHEN" && !typeUpper.includes("KOT") && !typeUpper.includes("KITCHEN") && !typeUpper.includes("PASS")) return false;

            // Search Query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const titleMatch = String(item.title || "").toLowerCase().includes(q);
                const msgMatch = String(item.message || "").toLowerCase().includes(q);
                return titleMatch || msgMatch;
            }

            return true;
        });
    }, [notifications, filterType, searchQuery]);

    // Format Relative Time
    const formatTimeLabel = (value) => {
        const dt = new Date(value);
        if (Number.isNaN(dt.getTime())) return "Just now";
        return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    return (
        <div className="flex-1 p-3 sm:p-4 max-w-4xl mx-auto w-full space-y-4 animate-in fade-in duration-200">
            {/* Top Navigation & Action Header */}
            <div className="flex items-center justify-between gap-3 border-b border-[color:var(--app-border)]/40 pb-3">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={onBackToFloorPlan}
                        className="flex items-center gap-1.5 rounded-xl border border-[color:var(--app-border)]/40 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold theme-muted hover:text-[color:var(--app-text)] transition cursor-pointer"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back to Floor Plan</span>
                    </button>
                    <div>
                        <h1 className="text-base sm:text-lg font-black tracking-tight text-[color:var(--app-text)] flex items-center gap-2">
                            Notifications
                            <span className="rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30 px-2 py-0.5 text-[9px] font-extrabold">
                                {unreadCount} UNREAD
                            </span>
                        </h1>
                        <p className="text-[11px] theme-muted">Real-time alerts for orders, kitchen tickets, and table assignments</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => fetchNotifications(true)}
                        disabled={refreshing}
                        className="p-2 rounded-xl border border-[color:var(--app-border)]/40 bg-white dark:bg-slate-900 theme-muted hover:text-[color:var(--app-text)] transition cursor-pointer"
                        title="Refresh Notifications"
                    >
                        <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                    </button>
                    <button
                        type="button"
                        onClick={handleMarkAllRead}
                        disabled={unreadCount === 0}
                        className="flex items-center gap-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-3.5 py-1.5 text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <CheckCheck className="h-3.5 w-3.5" />
                        <span className="hidden min-[480px]:inline">Mark all read</span>
                    </button>
                </div>
            </div>

            {/* Filter Tabs & Search Input */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 rounded-2xl border border-[color:var(--app-border)]/40 bg-white dark:bg-slate-900 p-2.5 shadow-xs text-xs">
                {/* Quick Filters */}
                <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
                    {[
                        { id: "ALL", label: "All" },
                        { id: "UNREAD", label: "Unread" },
                        { id: "ORDERS", label: "Orders" },
                        { id: "KITCHEN", label: "Kitchen Pass" },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setFilterType(tab.id)}
                            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                                filterType === tab.id
                                    ? "bg-orange-500 text-white shadow-xs"
                                    : "theme-muted hover:text-[color:var(--app-text)]"
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Search Bar */}
                <div className="relative w-full sm:w-60">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 theme-muted" />
                    <input
                        type="text"
                        placeholder="Search notifications..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-xl border border-[color:var(--app-border)]/40 bg-transparent pl-8 pr-3 py-1.5 text-xs text-[color:var(--app-text)] outline-none focus:border-orange-500"
                    />
                </div>
            </div>

            {/* Notifications List Body */}
            {loading ? (
                <div className="flex justify-center p-12">
                    <LoaderCircle className="h-8 w-8 animate-spin text-orange-500" />
                </div>
            ) : filteredNotifications.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[color:var(--app-border)]/60 bg-white/40 dark:bg-slate-900/40 p-12 text-center theme-muted space-y-2">
                    <Bell className="h-8 w-8 mx-auto opacity-40 text-orange-500" />
                    <p className="font-bold text-xs">No notifications found matching selected filter.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filteredNotifications.map((item) => {
                        const isUnread = !item.isRead && !item.read;
                        const typeUpper = String(item.notificationType || item.type || "INFO").toUpperCase();
                        const isKitchen = typeUpper.includes("KOT") || typeUpper.includes("KITCHEN") || typeUpper.includes("READY");
                        const isOrder = typeUpper.includes("ORDER");

                        return (
                            <div
                                key={item.id}
                                onClick={() => isUnread && handleMarkSingleRead(item.id)}
                                className={`group relative flex items-start justify-between gap-3 rounded-2xl border p-3.5 transition-all duration-150 shadow-xs cursor-pointer ${
                                    isUnread
                                        ? "border-orange-500/40 bg-orange-500/5 dark:bg-orange-950/20"
                                        : "border-[color:var(--app-border)]/40 bg-white dark:bg-slate-900 opacity-90"
                                }`}
                            >
                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                    {/* Type Icon Badge */}
                                    <div
                                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold ${
                                            isKitchen
                                                ? "bg-emerald-500/20 text-emerald-600 border border-emerald-500/30"
                                                : isOrder
                                                ? "bg-sky-500/20 text-sky-600 border border-sky-500/30"
                                                : "bg-orange-500/20 text-orange-600 border border-orange-500/30"
                                        }`}
                                    >
                                        {isKitchen ? (
                                            <ChefHat className="h-4 w-4" />
                                        ) : isOrder ? (
                                            <ShoppingBag className="h-4 w-4" />
                                        ) : (
                                            <Bell className="h-4 w-4" />
                                        )}
                                    </div>

                                    {/* Text Info */}
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h4 className={`text-xs ${isUnread ? "font-black text-[color:var(--app-text)]" : "font-semibold text-[color:var(--app-text)]/80"}`}>
                                                {item.title}
                                            </h4>
                                            {isUnread && (
                                                <span className="h-2 w-2 rounded-full bg-orange-500 shrink-0" title="Unread" />
                                            )}
                                        </div>

                                        <p className="text-xs theme-muted leading-relaxed">{item.message}</p>

                                        <div className="flex items-center gap-3 pt-1 text-[10px] theme-muted">
                                            <span className="flex items-center gap-1 font-mono">
                                                <Clock className="h-3 w-3 opacity-60" />
                                                <span>{formatTimeLabel(item.createdAt)}</span>
                                            </span>
                                            {item.data?.tableNo && (
                                                <span className="font-bold text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded-md">
                                                    Table {item.data.tableNo}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Item Actions */}
                                <div className="flex items-center gap-1.5 shrink-0 self-center">
                                    {item.data?.tableNo && onSelectTable && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSelectTable(item.data.tableNo);
                                            }}
                                            className="rounded-lg bg-orange-500 hover:bg-orange-600 text-white px-2.5 py-1 text-[10px] font-bold transition shadow-xs"
                                        >
                                            View Table
                                        </button>
                                    )}

                                    {isUnread && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleMarkSingleRead(item.id);
                                            }}
                                            className="p-1 text-slate-400 hover:text-emerald-500 transition rounded-lg"
                                            title="Mark Read"
                                        >
                                            <Check className="h-4 w-4" />
                                        </button>
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
