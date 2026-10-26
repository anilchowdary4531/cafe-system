import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    Bell,
    Check,
    CheckCheck,
    Clock,
    Filter,
    LoaderCircle,
    RefreshCw,
    Search,
    ShoppingBag,
    CheckCircle2,
    AlertTriangle,
    Info,
    Volume2,
} from "lucide-react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useStaffSocket } from "../context/StaffSocketContext";
import { API } from "../config";
import { showToast } from "../utils/toast";
import { playNotificationSound, triggerNotificationVibration } from "../utils/soundPlayer";

const formatTime = (value) => {
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return "Just now";
    return dt.toLocaleString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });
};

export default function StaffNotificationsView({
    onBack,
    backLabel = "Back to Workspace",
    title = "Staff Notifications",
}) {
    const navigate = useNavigate();
    const { user, token } = useAuth();
    const { socket } = useStaffSocket();

    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filterType, setFilterType] = useState("ALL"); // ALL | UNREAD | URGENT | TASKS
    const [searchQuery, setSearchQuery] = useState("");
    const [unreadCount, setUnreadCount] = useState(0);

    const handleBack = () => {
        if (typeof onBack === "function") {
            onBack();
        } else {
            navigate(-1);
        }
    };

    const fetchNotifications = useCallback(async () => {
        if (!token) return;
        try {
            const res = await axios.get(`${API}/api/notifications`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { page: 1, limit: 100 },
            });
            const list = res.data?.notifications || res.data?.data || [];
            setNotifications(list);
            const unread = list.filter((n) => !n.isRead && !n.read).length;
            setUnreadCount(unread);
        } catch (err) {
            console.error("Failed to fetch staff notifications:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [token]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    // Realtime listener for incoming notification:new
    useEffect(() => {
        if (!socket) return;

        const handleNewNotification = (notif) => {
            if (!notif) return;
            setNotifications((prev) => [notif, ...prev]);
            setUnreadCount((prev) => prev + 1);
            playNotificationSound();
            triggerNotificationVibration();
            showToast({
                title: notif.title || "New Notification",
                message: notif.message || "You have a new update.",
                variant: notif.priority === "URGENT" || notif.type === "URGENT" ? "error" : "info",
            });
        };

        socket.on("notification:new", handleNewNotification);
        return () => {
            socket.off("notification:new", handleNewNotification);
        };
    }, [socket]);

    const handleMarkAsRead = async (id) => {
        try {
            await axios.put(
                `${API}/api/notifications/${id}/read`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, isRead: true, read: true } : n))
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));
        } catch (err) {
            console.error("Failed to mark notification as read:", err);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await axios.put(
                `${API}/api/notifications/read-all`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, read: true })));
            setUnreadCount(0);
            showToast({
                title: "All Caught Up",
                message: "All notifications marked as read.",
                variant: "success",
            });
        } catch (err) {
            console.error("Failed to mark all notifications as read:", err);
        }
    };

    const filteredNotifications = useMemo(() => {
        return notifications.filter((n) => {
            const isRead = Boolean(n.isRead || n.read);
            if (filterType === "UNREAD" && isRead) return false;
            if (filterType === "URGENT" && n.priority !== "URGENT" && n.type !== "URGENT") return false;
            if (filterType === "TASKS" && !String(n.type || "").includes("TASK")) return false;

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const titleMatch = String(n.title || "").toLowerCase().includes(q);
                const msgMatch = String(n.message || "").toLowerCase().includes(q);
                const tableMatch = String(n.tableNo || "").toLowerCase().includes(q);
                return titleMatch || msgMatch || tableMatch;
            }
            return true;
        });
    }, [notifications, filterType, searchQuery]);

    return (
        <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans w-full">
            <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-4 sm:py-6 space-y-4">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800/80 pb-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                        <button
                            type="button"
                            onClick={handleBack}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800/80 text-neutral-300 hover:text-white hover:bg-neutral-800 transition min-h-[40px] shrink-0"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span className="text-xs sm:text-sm font-semibold">{backLabel}</span>
                        </button>
                        <div className="min-w-0">
                            <h1 className="text-base sm:text-xl font-bold tracking-tight text-white flex items-center gap-2.5 truncate">
                                <span>{title}</span>
                                {unreadCount > 0 && (
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 shrink-0">
                                        {unreadCount} unread
                                    </span>
                                )}
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={() => navigate("/staff/settings")}
                            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-neutral-900 border border-neutral-800/80 hover:bg-neutral-800 text-neutral-300 hover:text-white transition min-h-[40px] min-w-[40px] flex items-center justify-center gap-1.5"
                            title="Sound & Vibration Settings"
                            aria-label="Sound and vibration settings"
                        >
                            <Volume2 className="w-4 h-4 text-orange-400" />
                            <span className="text-xs font-semibold hidden md:inline">Sounds</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setRefreshing(true);
                                fetchNotifications();
                            }}
                            disabled={refreshing}
                            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-neutral-900 border border-neutral-800/80 hover:bg-neutral-800 text-neutral-300 hover:text-white transition min-h-[40px] min-w-[40px] flex items-center justify-center gap-1.5 disabled:opacity-50"
                            title="Refresh notifications"
                            aria-label="Refresh notifications"
                        >
                            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                            <span className="text-xs font-semibold hidden md:inline">Refresh</span>
                        </button>

                        {unreadCount > 0 && (
                            <button
                                type="button"
                                onClick={handleMarkAllAsRead}
                                className="px-3 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold flex items-center gap-1.5 transition min-h-[40px] shadow-sm"
                            >
                                <CheckCheck className="w-4 h-4" />
                                <span>Mark all read</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Filter and Search Bar Toolbar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Search notifications by title, message, or table..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-neutral-900/90 border border-neutral-800/80 rounded-xl pl-10 pr-3.5 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500/80 transition min-h-[42px]"
                        />
                    </div>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none shrink-0">
                        {["ALL", "UNREAD", "URGENT", "TASKS"].map((type) => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => setFilterType(type)}
                                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap min-h-[40px] transition cursor-pointer ${
                                    filterType === type
                                        ? "bg-orange-500 text-white shadow-sm"
                                        : "bg-neutral-900/90 text-neutral-300 hover:text-white border border-neutral-800/80 hover:bg-neutral-800/80"
                                }`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Notifications List */}
                {loading ? (
                    <div className="py-24 flex flex-col items-center justify-center text-neutral-400 gap-3">
                        <LoaderCircle className="w-8 h-8 animate-spin text-orange-500" />
                        <p className="text-sm">Loading notifications...</p>
                    </div>
                ) : filteredNotifications.length === 0 ? (
                    <div className="py-20 text-center rounded-2xl border border-neutral-800/60 bg-neutral-900/30 p-8">
                        <Bell className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                        <h3 className="text-base font-bold text-neutral-200">No notifications</h3>
                        <p className="text-xs text-neutral-400 mt-1">
                            {filterType === "UNREAD" ? "You have read all your notifications." : "No notifications found."}
                        </p>
                    </div>
                ) : (
                    <div className="rounded-2xl border border-neutral-800/70 bg-neutral-900/30 divide-y divide-neutral-800/50 overflow-hidden shadow-sm">
                        {filteredNotifications.map((notif) => {
                            const isRead = Boolean(notif.isRead || notif.read);
                            const isUrgent = notif.priority === "URGENT" || notif.type === "URGENT";
                            return (
                                <div
                                    key={notif.id}
                                    className={`p-3.5 sm:p-4.5 transition flex items-start justify-between gap-3.5 hover:bg-neutral-900/60 ${
                                        isRead
                                            ? "opacity-75 hover:opacity-100"
                                            : isUrgent
                                            ? "bg-rose-950/20"
                                            : "bg-transparent"
                                    }`}
                                >
                                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                                            isUrgent
                                                ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                                : isRead
                                                ? "bg-neutral-800 text-neutral-400"
                                                : "bg-orange-500/15 text-orange-400 border border-orange-500/30"
                                        }`}>
                                            {isUrgent ? <AlertTriangle className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                                        </div>
                                        <div className="min-w-0 flex-1 space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h4 className="font-semibold text-sm text-white truncate">
                                                    {notif.title || "Staff Alert"}
                                                </h4>
                                                {notif.tableNo && (
                                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-neutral-800/90 text-neutral-200 border border-neutral-700/60">
                                                        Table {notif.tableNo}
                                                    </span>
                                                )}
                                                {isUrgent && (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                                        URGENT
                                                    </span>
                                                )}
                                                {!isRead && (
                                                    <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" title="Unread" />
                                                )}
                                            </div>
                                            <p className="text-xs text-neutral-300 break-words leading-relaxed">
                                                {notif.message}
                                            </p>
                                            <div className="flex items-center gap-2 pt-0.5 text-[11px] text-neutral-400">
                                                <Clock className="w-3 h-3 text-neutral-500" />
                                                <span>{formatTime(notif.createdAt)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {!isRead && (
                                        <button
                                            type="button"
                                            onClick={() => handleMarkAsRead(notif.id)}
                                            className="px-2.5 py-1.5 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold transition shrink-0 min-h-[34px] flex items-center gap-1 border border-neutral-700/50"
                                            title="Mark as read"
                                            aria-label="Mark notification as read"
                                        >
                                            <Check className="w-3.5 h-3.5" />
                                            <span className="hidden sm:inline">Read</span>
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
