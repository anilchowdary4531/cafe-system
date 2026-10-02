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
    Volume2,
    CheckCircle2,
} from "lucide-react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useStaffSocket } from "../context/StaffSocketContext";
import { API } from "../config";
import { showToast } from "../utils/toast";
import NotificationSoundPicker from "./NotificationSoundPicker";

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

export default function ServerNotificationsView({
    onBackToFloorPlan,
    onNavigateToTable,
    onSelectTable,
    onUnreadCountChange,
}) {
    const { user, token } = useAuth();
    const { socket } = useStaffSocket();

    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [filterType, setFilterType] = useState("ALL"); // ALL | UNREAD | ORDERS | KITCHEN | SUCCESS | INFO
    const [searchQuery, setSearchQuery] = useState("");
    const [showSoundSettings, setShowSoundSettings] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    const handleSelectTable = onNavigateToTable || onSelectTable;

    const authHeaders = useMemo(() => {
        return token ? { Authorization: `Bearer ${token}` } : {};
    }, [token]);

    // Fetch notifications from API
    const fetchNotifications = useCallback(
        async (pageNum = 1, isSilent = false) => {
            if (pageNum === 1) {
                if (!isSilent) setLoading(true);
                else setRefreshing(true);
            } else {
                setLoadingMore(true);
            }

            try {
                const res = await axios.get(`${API}/api/notifications?page=${pageNum}&limit=20`, {
                    headers: authHeaders,
                    withCredentials: true,
                });

                if (res.data) {
                    const list = Array.isArray(res.data.notifications)
                        ? res.data.notifications
                        : Array.isArray(res.data)
                        ? res.data
                        : [];

                    setNotifications((prev) => {
                        if (pageNum === 1) return list;
                        // Deduplicate when appending subsequent pages
                        const existingIds = new Set(prev.map((n) => String(n.id)));
                        const newUnique = list.filter((n) => !existingIds.has(String(n.id)));
                        return [...prev, ...newUnique];
                    });

                    const totalCount = res.data.total ?? list.length;
                    const serverUnread = res.data.unreadCount ?? list.filter((it) => !it.isRead && !it.read).length;
                    setUnreadCount(serverUnread);
                    if (onUnreadCountChange) onUnreadCountChange(serverUnread);

                    setHasMore(res.data.hasMore ?? pageNum * 20 < totalCount);
                    setPage(pageNum);
                }
            } catch (err) {
                console.error("Failed to fetch notifications:", err);
            } finally {
                setLoading(false);
                setRefreshing(false);
                setLoadingMore(false);
            }
        },
        [authHeaders, onUnreadCountChange]
    );

    useEffect(() => {
        fetchNotifications(1);
    }, [fetchNotifications]);

    // Real-time Socket.IO Listener
    useEffect(() => {
        if (!socket) return undefined;

        const handleNewNotification = (notification) => {
            if (!notification) return;
            setNotifications((prev) => {
                const exists = prev.some((n) => String(n.id) === String(notification.id));
                if (exists) return prev;
                return [notification, ...prev];
            });
            setUnreadCount((prev) => {
                const nextCount = prev + 1;
                if (onUnreadCountChange) onUnreadCountChange(nextCount);
                return nextCount;
            });
        };

        const handleRefetch = () => fetchNotifications(1, true);

        socket.on("notification:new", handleNewNotification);
        socket.on("table:waiter_assigned", handleRefetch);
        socket.on("order:created", handleRefetch);
        socket.on("kot:status_updated", handleRefetch);
        socket.on("bill:requested", handleRefetch);
        socket.on("waiter:called", handleRefetch);

        return () => {
            socket.off("notification:new", handleNewNotification);
            socket.off("table:waiter_assigned", handleRefetch);
            socket.off("order:created", handleRefetch);
            socket.off("kot:status_updated", handleRefetch);
            socket.off("bill:requested", handleRefetch);
            socket.off("waiter:called", handleRefetch);
        };
    }, [socket, fetchNotifications, onUnreadCountChange]);

    // Mark Single Notification Read
    const handleMarkSingleRead = async (notificationId) => {
        try {
            setNotifications((prev) =>
                prev.map((n) =>
                    String(n.id) === String(notificationId) ? { ...n, isRead: true, read: true } : n
                )
            );
            setUnreadCount((prev) => {
                const nextCount = Math.max(0, prev - 1);
                if (onUnreadCountChange) onUnreadCountChange(nextCount);
                return nextCount;
            });

            await axios.patch(
                `${API}/api/notifications/${notificationId}/read`,
                {},
                {
                    headers: authHeaders,
                    withCredentials: true,
                }
            );
        } catch (err) {
            console.error("Failed to mark notification read:", err);
        }
    };

    // Mark All Notifications Read
    const handleMarkAllRead = async () => {
        try {
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, read: true })));
            setUnreadCount(0);
            if (onUnreadCountChange) onUnreadCountChange(0);

            await axios.patch(
                `${API}/api/notifications/read-all`,
                {},
                {
                    headers: authHeaders,
                    withCredentials: true,
                }
            );

            showToast({
                title: "Notifications Read ✅",
                message: "All notifications marked as read.",
                variant: "success",
            });
        } catch (err) {
            console.error("Failed to mark all read:", err);
        }
    };

    // Filter & Search Notifications
    const filteredNotifications = useMemo(() => {
        return notifications.filter((item) => {
            const isUnread = !item.isRead && !item.read;
            const typeUpper = String(item.notificationType || item.type || "").toUpperCase();

            // Filter Type
            if (filterType === "UNREAD" && !isUnread) return false;

            if (filterType === "ORDERS") {
                if (!typeUpper.includes("ORDER")) return false;
            } else if (filterType === "KITCHEN") {
                if (!typeUpper.includes("KOT") && !typeUpper.includes("KITCHEN") && !typeUpper.includes("FOOD") && !typeUpper.includes("PASS") && !typeUpper.includes("READY")) return false;
            } else if (filterType === "SUCCESS") {
                if (!typeUpper.includes("SUCCESS") && !typeUpper.includes("PAYMENT") && !typeUpper.includes("DELIVERED") && !typeUpper.includes("ACCEPTED")) return false;
            } else if (filterType === "INFO") {
                if (typeUpper.includes("ORDER") || typeUpper.includes("KOT") || typeUpper.includes("KITCHEN") || typeUpper.includes("SUCCESS")) return false;
            }

            // Search Query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const titleMatch = String(item.title || "").toLowerCase().includes(q);
                const msgMatch = String(item.message || "").toLowerCase().includes(q);
                const typeMatch = String(item.type || item.notificationType || "").toLowerCase().includes(q);
                return titleMatch || msgMatch || typeMatch;
            }

            return true;
        });
    }, [notifications, filterType, searchQuery]);

    return (
        <div className="min-h-screen bg-[color:var(--app-bg,#f8fafc)] text-[color:var(--app-text,#0f172a)] p-3 space-y-3">
            {/* Header Bar - Compact Layout aligned with Owner Notifications */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[color:var(--app-border)]/40 pb-2.5">
                <div className="flex items-center gap-2">
                    {onBackToFloorPlan && (
                        <button
                            type="button"
                            onClick={onBackToFloorPlan}
                            className="flex items-center gap-1.5 rounded-xl border border-[color:var(--app-border)]/40 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold theme-muted hover:text-[color:var(--app-text)] transition cursor-pointer mr-1"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            <span className="hidden sm:inline">Floor Plan</span>
                        </button>
                    )}
                    <div className="rounded-xl bg-orange-500/10 p-1.5 text-orange-500 border border-orange-500/20">
                        <Bell className="h-4 w-4" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold tracking-tight text-[color:var(--app-text)] flex items-center gap-2">
                            Notifications
                            <span className="rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/20 px-2 py-0.2 text-[10px] font-extrabold">
                                {unreadCount} UNREAD
                            </span>
                        </h1>
                        <p className="text-[11px] theme-muted">
                            Real-time alerts for orders, kitchen tickets, and table assignments.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setShowSoundSettings((prev) => !prev)}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition ${
                            showSoundSettings
                                ? "bg-orange-500 text-white shadow-sm"
                                : "bg-black/5 dark:bg-white/5 theme-muted hover:text-[color:var(--app-text)]"
                        }`}
                        title="Adjust Notification Sound"
                    >
                        <Volume2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Sound Settings</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => fetchNotifications(1, true)}
                        disabled={refreshing}
                        className="rounded-lg bg-black/5 dark:bg-white/5 p-1.5 text-xs font-bold theme-muted hover:text-[color:var(--app-text)] transition cursor-pointer"
                        title="Refresh Notifications"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                    </button>

                    <button
                        type="button"
                        onClick={handleMarkAllRead}
                        disabled={unreadCount === 0}
                        className="rounded-lg bg-orange-500 px-3 py-1 text-xs font-bold text-white shadow-sm hover:bg-orange-600 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                        Mark all as read
                    </button>
                </div>
            </div>

            {/* Notification Sound Picker - Toggle Panel */}
            {showSoundSettings && (
                <div className="animate-in fade-in duration-200">
                    <NotificationSoundPicker defaultExpanded={true} />
                </div>
            )}

            {/* Filter & Search Bar - Alignment with Owner Notifications */}
            <div className="flex flex-wrap items-center justify-between gap-2 py-1 text-xs">
                {/* Filter Quick Tabs */}
                <div className="flex items-center gap-1 overflow-x-auto py-0.5 text-[11px] scrollbar-none">
                    {["ALL", "UNREAD", "ORDERS", "KITCHEN", "SUCCESS", "INFO"].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setFilterType(tab)}
                            className={`rounded-lg px-3 py-1 font-bold transition whitespace-nowrap cursor-pointer ${
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

            {/* Notifications List */}
            {loading ? (
                <div className="flex justify-center p-12">
                    <LoaderCircle className="h-8 w-8 animate-spin text-orange-500" />
                </div>
            ) : filteredNotifications.length === 0 ? (
                <div className="py-12 text-center theme-muted space-y-1.5 border border-dashed border-[color:var(--app-border)]/40 rounded-2xl">
                    <Bell className="h-6 w-6 mx-auto opacity-40 text-orange-500" />
                    <p className="font-bold text-xs">No notifications found.</p>
                </div>
            ) : (
                <div className="space-y-1">
                    {filteredNotifications.map((item) => {
                        const isUnread = !item.isRead && !item.read;
                        const typeUpper = String(item.notificationType || item.type || "INFO").toUpperCase();
                        const isKitchen = typeUpper.includes("KOT") || typeUpper.includes("KITCHEN") || typeUpper.includes("FOOD") || typeUpper.includes("PASS") || typeUpper.includes("READY");
                        const isOrder = typeUpper.includes("ORDER");
                        const isSuccess = typeUpper.includes("SUCCESS") || typeUpper.includes("PAYMENT") || typeUpper.includes("DELIVERED");

                        const tableNo = item.data?.tableNo || item.data?.table_number || item.metadata?.tableNo || item.data?.table;

                        return (
                            <div
                                key={item.id}
                                className={`flex items-start justify-between gap-3 px-3.5 py-3 rounded-xl transition hover:bg-black/5 dark:hover:bg-white/5 ${
                                    isUnread ? "bg-orange-500/5 dark:bg-orange-950/20 border border-orange-500/20" : "border border-[color:var(--app-border)]/20 opacity-90"
                                }`}
                            >
                                <div className="min-w-0 flex-1 space-y-1">
                                    {/* Line 1: Unread Dot, Title, Category Badge */}
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        {isUnread && (
                                            <span className="h-1.5 w-1.5 rounded-full bg-orange-500 flex-shrink-0" title="Unread" />
                                        )}
                                        <h4 className={`text-xs ${isUnread ? "font-extrabold text-[color:var(--app-text)]" : "font-semibold text-[color:var(--app-text)]/90"}`}>
                                            {item.title}
                                        </h4>
                                        <span
                                            className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                                isOrder
                                                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                                    : isKitchen
                                                    ? "bg-sky-500/15 text-sky-600 dark:text-sky-400"
                                                    : isSuccess
                                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                                    : "bg-orange-500/15 text-orange-600 dark:text-orange-400"
                                            }`}
                                        >
                                            {item.notificationType || item.type || "INFO"}
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

                                {/* Right Column: Table Action, Time & Mark Read Action */}
                                <div className="flex items-center gap-2 flex-shrink-0 text-[10px] theme-muted pt-0.5">
                                    {tableNo && handleSelectTable && (
                                        <button
                                            type="button"
                                            onClick={() => handleSelectTable(tableNo)}
                                            className="rounded-lg bg-orange-500/10 hover:bg-orange-500 text-orange-600 dark:text-orange-400 hover:text-white px-2 py-0.5 font-bold transition flex items-center gap-0.5 cursor-pointer"
                                            title={`View Table ${tableNo}`}
                                        >
                                            View Table
                                        </button>
                                    )}

                                    <span className="flex items-center gap-1 whitespace-nowrap hidden sm:flex">
                                        <Clock className="h-3 w-3 opacity-60" />
                                        {formatTime(item.createdAt)}
                                    </span>

                                    {isUnread ? (
                                        <button
                                            type="button"
                                            onClick={() => handleMarkSingleRead(item.id)}
                                            className="rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 px-2 py-0.5 font-bold hover:bg-orange-500 hover:text-white transition flex items-center gap-0.5 cursor-pointer"
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

            {/* Load More Button for Pagination */}
            {hasMore && !loading && (
                <div className="pt-2 text-center">
                    <button
                        type="button"
                        onClick={() => fetchNotifications(page + 1)}
                        disabled={loadingMore}
                        className="rounded-xl border border-[color:var(--app-border)]/40 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-bold theme-muted hover:text-[color:var(--app-text)] transition cursor-pointer shadow-xs"
                    >
                        {loadingMore ? (
                            <span className="flex items-center justify-center gap-2">
                                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                Loading More...
                            </span>
                        ) : (
                            "Load More Notifications"
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
