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
    Volume2,
    CheckCircle2,
    AlertTriangle,
    Info,
} from "lucide-react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useStaffSocket } from "../context/StaffSocketContext";
import { API } from "../config";
import { showToast } from "../utils/toast";
import NotificationSoundPicker from "./NotificationSoundPicker";
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
    const [showSoundSettings, setShowSoundSettings] = useState(false);
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
        <div className="min-h-screen bg-neutral-950 text-neutral-100 p-4 sm:p-6 md:p-8 font-sans">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleBack}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-800 transition min-h-[44px]"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span className="text-sm font-semibold">{backLabel}</span>
                        </button>
                        <div>
                            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                                {title}
                                {unreadCount > 0 && (
                                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-600 text-white">
                                        {unreadCount} unread
                                    </span>
                                )}
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShowSoundSettings(!showSoundSettings)}
                            className="px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold flex items-center gap-1.5 transition min-h-[44px]"
                        >
                            <Volume2 className="w-4 h-4 text-orange-400" />
                            <span>Sounds</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setRefreshing(true);
                                fetchNotifications();
                            }}
                            disabled={refreshing}
                            className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 transition min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-50"
                            title="Refresh notifications"
                        >
                            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                        </button>
                        {unreadCount > 0 && (
                            <button
                                type="button"
                                onClick={handleMarkAllAsRead}
                                className="px-3 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold flex items-center gap-1.5 transition min-h-[44px]"
                            >
                                <CheckCheck className="w-4 h-4" />
                                <span>Mark all read</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Collapsible sound picker */}
                {showSoundSettings && (
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-xl">
                        <NotificationSoundPicker defaultExpanded={false} />
                    </div>
                )}

                {/* Filter and Search Bar */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Search notifications..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500 min-h-[44px]"
                        />
                    </div>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                        {["ALL", "UNREAD", "URGENT", "TASKS"].map((type) => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => setFilterType(type)}
                                className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap min-h-[44px] transition ${
                                    filterType === type
                                        ? "bg-orange-600 text-white shadow-sm"
                                        : "bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800"
                                }`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Notifications List */}
                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center text-neutral-400 gap-3">
                        <LoaderCircle className="w-8 h-8 animate-spin text-orange-500" />
                        <p className="text-sm">Loading notifications...</p>
                    </div>
                ) : filteredNotifications.length === 0 ? (
                    <div className="py-16 text-center bg-neutral-900/50 border border-neutral-800/80 rounded-2xl p-8">
                        <Bell className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                        <h3 className="text-base font-bold text-neutral-200">No notifications</h3>
                        <p className="text-xs text-neutral-400 mt-1">
                            {filterType === "UNREAD" ? "You have read all your notifications." : "No notifications found."}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {filteredNotifications.map((notif) => {
                            const isRead = Boolean(notif.isRead || notif.read);
                            const isUrgent = notif.priority === "URGENT" || notif.type === "URGENT";
                            return (
                                <div
                                    key={notif.id}
                                    className={`p-4 rounded-2xl border transition flex items-start justify-between gap-3 ${
                                        isRead
                                            ? "bg-neutral-900/60 border-neutral-800/80 text-neutral-300"
                                            : isUrgent
                                            ? "bg-red-950/30 border-red-800/60 text-white shadow-sm shadow-red-950/40"
                                            : "bg-neutral-900 border-neutral-700/80 text-white shadow-sm"
                                    }`}
                                >
                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                                            isUrgent
                                                ? "bg-red-500/20 text-red-400 border border-red-500/40"
                                                : isRead
                                                ? "bg-neutral-800 text-neutral-400"
                                                : "bg-orange-500/20 text-orange-400 border border-orange-500/40"
                                        }`}>
                                            {isUrgent ? <AlertTriangle className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h4 className="font-bold text-sm text-white truncate">
                                                    {notif.title || "Staff Alert"}
                                                </h4>
                                                {notif.tableNo && (
                                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-800 text-neutral-200 border border-neutral-700">
                                                        Table {notif.tableNo}
                                                    </span>
                                                )}
                                                {!isRead && (
                                                    <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                                                )}
                                            </div>
                                            <p className="text-xs text-neutral-300 mt-1 break-words">
                                                {notif.message}
                                            </p>
                                            <div className="flex items-center gap-2 mt-2 text-[11px] text-neutral-500">
                                                <Clock className="w-3 h-3" />
                                                <span>{formatTime(notif.createdAt)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {!isRead && (
                                        <button
                                            type="button"
                                            onClick={() => handleMarkAsRead(notif.id)}
                                            className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition shrink-0 min-h-[36px]"
                                            title="Mark as read"
                                        >
                                            <Check className="w-3.5 h-3.5" />
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
