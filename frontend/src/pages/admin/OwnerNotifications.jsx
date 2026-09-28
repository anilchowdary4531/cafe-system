import { useEffect, useMemo, useState } from "react";
import {
    Bell,
    Check,
    CheckCheck,
    Clock,
    Filter,
    Search,
    Volume2,
} from "lucide-react";
import {
    getOwnerNotifications,
    markAllOwnerNotificationsRead,
    markOwnerNotificationRead,
    subscribeOwnerNotifications,
} from "../../utils/ownerNotifications";
import OwnerMenuButton from "../../components/OwnerMenuButton";
import NotificationSoundPicker from "../../components/NotificationSoundPicker";

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
    const [notifications, setNotifications] = useState(() => getOwnerNotifications());
    const [filterType, setFilterType] = useState("ALL"); // ALL | UNREAD | ORDERS | SUCCESS | INFO
    const [searchQuery, setSearchQuery] = useState("");
    const [showSoundSettings, setShowSoundSettings] = useState(false);

    const unreadCount = useMemo(
        () => notifications.reduce((sum, item) => sum + (item.read ? 0 : 1), 0),
        [notifications]
    );

    useEffect(() => {
        const unsubscribe = subscribeOwnerNotifications((next) => {
            setNotifications(Array.isArray(next) ? next : []);
        });
        return unsubscribe;
    }, []);

    const onMarkAllRead = () => {
        markAllOwnerNotificationsRead();
        setNotifications(getOwnerNotifications());
    };

    const onMarkOneRead = (id) => {
        markOwnerNotificationRead(id);
        setNotifications(getOwnerNotifications());
    };

    // Filter & Search Notifications
    const filteredNotifications = useMemo(() => {
        return notifications.filter((item) => {
            // Type / Unread filter
            if (filterType === "UNREAD" && item.read) return false;
            if (filterType !== "ALL" && filterType !== "UNREAD") {
                const itemType = String(item.type || "").toUpperCase();
                if (!itemType.includes(filterType.toUpperCase())) return false;
            }

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
                            Real-time owner activity alerts and system updates.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setShowSoundSettings((prev) => !prev)}
                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-bold transition ${
                            showSoundSettings
                                ? "border-orange-500 bg-orange-500 text-white shadow-sm"
                                : "border-[color:var(--app-border)]/60 bg-white dark:bg-slate-900 theme-muted hover:text-[color:var(--app-text)]"
                        }`}
                        title="Adjust Notification Sound"
                    >
                        <Volume2 className="h-3.5 w-3.5" />
                        <span>Sound Settings</span>
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

            {/* Notification Sound Picker - Hidden by default, toggled via Sound Settings button */}
            {showSoundSettings && (
                <div className="animate-in fade-in duration-200">
                    <NotificationSoundPicker defaultExpanded={true} />
                </div>
            )}

            {/* Filter & Search Bar - High Density */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[color:var(--app-border)]/40 bg-white dark:bg-slate-900 p-2 shadow-sm text-xs">
                {/* Filter Quick Tabs */}
                <div className="flex items-center gap-1 overflow-x-auto py-0.5 text-[11px]">
                    {["ALL", "UNREAD", "ORDERS", "SUCCESS", "INFO"].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setFilterType(tab)}
                            className={`rounded-md px-2.5 py-1 font-bold transition ${
                                filterType === tab
                                    ? "bg-orange-500 text-white shadow-sm"
                                    : "theme-muted hover:text-[color:var(--app-text)]"
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Search Bar */}
                <div className="relative w-full md:w-56">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 theme-muted" />
                    <input
                        type="text"
                        placeholder="Search notifications..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-lg border border-[color:var(--app-border)]/40 bg-transparent pl-8 pr-3 py-1 text-xs text-[color:var(--app-text)] outline-none focus:border-orange-500"
                    />
                </div>
            </div>

            {/* Compact Notifications List */}
            {filteredNotifications.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[color:var(--app-border)]/60 bg-white/40 dark:bg-slate-900/40 p-8 text-center theme-muted space-y-1">
                    <Bell className="h-6 w-6 mx-auto opacity-50" />
                    <p className="font-bold text-xs">No notifications found.</p>
                </div>
            ) : (
                <div className="rounded-xl border border-[color:var(--app-border)]/40 bg-white dark:bg-slate-900 divide-y divide-[color:var(--app-border)]/30 overflow-hidden shadow-sm">
                    {filteredNotifications.map((item) => {
                        const isUnread = !item.read;
                        const typeUpper = String(item.type || "INFO").toUpperCase();
                        const isSuccess = typeUpper.includes("SUCCESS");
                        const isOrder = typeUpper.includes("ORDER");

                        return (
                            <div
                                key={item.id}
                                className={`flex items-start justify-between gap-2.5 px-3 py-2 transition hover:bg-black/5 dark:hover:bg-white/5 ${
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
                                        <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border uppercase tracking-wider ${
                                            isOrder ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" :
                                            isSuccess ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" :
                                            "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30"
                                        }`}>
                                            {item.type}
                                        </span>
                                    </div>

                                    {/* Line 2: Message Content */}
                                    <p className="text-[11px] theme-muted leading-tight truncate">
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
                                            className="rounded border border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 font-bold hover:bg-orange-500 hover:text-white transition flex items-center gap-0.5"
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
