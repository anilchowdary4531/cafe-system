import { useEffect, useMemo, useState, useCallback } from "react";
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
    CheckCircle2,
    AlertTriangle,
    Info,
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
                variant: notif.priority === "URGENT" ? "error" : "info",
            });
        };

        socket.on("notification:new", handleNewNotification);
        socket.on("notification:sound", playNotificationSound);

        return () => {
            socket.off("notification:new", handleNewNotification);
            socket.off("notification:sound", playNotificationSound);
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
            setUnreadCount((c) => Math.max(0, c - 1));
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
        <div className="min-h-screen bg-white text-[#171717] font-sans flex flex-col">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-[#E7E5E4] px-3 py-2 sm:px-4 sm:py-2.5 shadow-xs">
                <div className="w-full flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <button
                            type="button"
                            onClick={handleBack}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-[#FFF7ED] text-[#57534E] hover:text-[#171717] border border-[#E7E5E4] transition min-h-[38px] shadow-xs cursor-pointer text-xs font-semibold"
                        >
                            <ArrowLeft className="w-4 h-4 text-[#F97316]" />
                            <span className="hidden sm:inline">{backLabel}</span>
                        </button>
                        <div>
                            <h1 className="text-base sm:text-lg font-bold text-[#171717] tracking-tight flex items-center gap-2">
                                <span>{title}</span>
                                {unreadCount > 0 && (
                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#FFF7ED] text-[#EA580C] border border-[#F97316]/30">
                                        {unreadCount} unread
                                    </span>
                                )}
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                setRefreshing(true);
                                fetchNotifications();
                            }}
                            disabled={refreshing}
                            className="p-2 sm:p-2.5 rounded-xl bg-white hover:bg-[#FFF7ED] border border-[#E7E5E4] text-[#57534E] hover:text-[#171717] transition min-h-[38px] min-w-[38px] flex items-center justify-center disabled:opacity-50 shadow-xs cursor-pointer"
                            title="Refresh notifications"
                        >
                            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                        </button>
                        {unreadCount > 0 && (
                            <button
                                type="button"
                                onClick={handleMarkAllAsRead}
                                className="px-3 py-1.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-bold flex items-center gap-1.5 transition min-h-[38px] shadow-xs cursor-pointer"
                            >
                                <CheckCheck className="w-4 h-4" />
                                <span>Mark all read</span>
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content - Full Width */}
            <main className="flex-1 w-full px-3 sm:px-4 md:px-6 py-4 space-y-3 max-w-none">

                {/* Filter and Search Bar */}
                <div className="flex flex-col sm:flex-row gap-2.5">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#78716C]" />
                        <input
                            type="text"
                            placeholder="Search notifications..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white border border-[#E7E5E4] rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-[#171717] placeholder-[#78716C] focus:outline-none focus:border-[#F97316] min-h-[38px] shadow-xs"
                        />
                    </div>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                        {["ALL", "UNREAD", "URGENT", "TASKS"].map((type) => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => setFilterType(type)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap min-h-[38px] transition cursor-pointer ${
                                    filterType === type
                                        ? "bg-[#F97316] text-white shadow-xs"
                                        : "bg-white text-[#57534E] hover:text-[#171717] hover:bg-[#FFF7ED] border border-[#E7E5E4]"
                                }`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Compact Notifications Feed */}
                {loading ? (
                    <div className="py-16 flex flex-col items-center justify-center text-[#78716C] gap-3">
                        <LoaderCircle className="w-7 h-7 animate-spin text-[#F97316]" />
                        <p className="text-xs sm:text-sm">Loading notifications...</p>
                    </div>
                ) : filteredNotifications.length === 0 ? (
                    <div className="py-16 text-center bg-white border border-[#E7E5E4] rounded-xl p-8 shadow-xs">
                        <Bell className="w-10 h-10 text-[#78716C] mx-auto mb-2 opacity-50" />
                        <h3 className="text-sm sm:text-base font-bold text-[#171717]">No notifications</h3>
                        <p className="text-xs text-[#57534E] mt-1">
                            {filterType === "UNREAD" ? "You have read all your notifications." : "No notifications match your current filter."}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filteredNotifications.map((notif) => {
                            const isRead = Boolean(notif.isRead || notif.read);
                            const isUrgent = notif.priority === "URGENT" || notif.type === "URGENT";
                            return (
                                <div
                                    key={notif.id}
                                    className={`p-3 rounded-xl border transition flex items-start justify-between gap-3 ${
                                        isUrgent
                                            ? "bg-[#FEF2F2] border-[#DC2626]/30 shadow-xs"
                                            : !isRead
                                            ? "bg-[#FFF7ED]/40 border-[#F97316]/30 shadow-xs"
                                            : "bg-white border-[#E7E5E4]"
                                    }`}
                                >
                                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                        {/* Status Dot / Icon */}
                                        <div className="mt-1 shrink-0">
                                            {isUrgent ? (
                                                <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626] block animate-pulse" />
                                            ) : !isRead ? (
                                                <span className="w-2.5 h-2.5 rounded-full bg-[#F97316] block" />
                                            ) : (
                                                <span className="w-2.5 h-2.5 rounded-full bg-[#D6D3D1] block" />
                                            )}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h4 className={`text-xs sm:text-sm font-bold truncate ${
                                                        isUrgent ? "text-[#DC2626]" : !isRead ? "text-[#171717]" : "text-[#57534E]"
                                                    }`}>
                                                        {notif.title || "Staff Alert"}
                                                    </h4>
                                                    {isUrgent && (
                                                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-[#DC2626] text-white">
                                                            URGENT
                                                        </span>
                                                    )}
                                                    {notif.tableNo && (
                                                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#FFF7ED] text-[#EA580C] border border-[#F97316]/30">
                                                            Table {notif.tableNo}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[11px] text-[#78716C] whitespace-nowrap shrink-0">
                                                    {formatTime(notif.createdAt)}
                                                </div>
                                            </div>

                                            <p className="text-xs text-[#57534E] mt-0.5 break-words">
                                                {notif.message}
                                            </p>
                                        </div>
                                    </div>

                                    {!isRead && (
                                        <button
                                            type="button"
                                            onClick={() => handleMarkAsRead(notif.id)}
                                            className="p-1.5 rounded-lg bg-white hover:bg-[#FFF7ED] border border-[#E7E5E4] text-[#57534E] hover:text-[#171717] text-xs font-semibold transition shrink-0 shadow-xs cursor-pointer"
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
            </main>
        </div>
    );
}
