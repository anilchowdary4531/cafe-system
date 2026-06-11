import { useEffect, useMemo, useState } from "react";
import { Bell, Check, CheckCheck, Clock3 } from "lucide-react";
import {
    getOwnerNotifications,
    markAllOwnerNotificationsRead,
    markOwnerNotificationRead,
    subscribeOwnerNotifications,
} from "../../utils/ownerNotifications";

const formatTime = (value) => {
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return "Just now";
    return dt.toLocaleString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
    });
};

export default function OwnerNotifications() {
    const [notifications, setNotifications] = useState(() => getOwnerNotifications());

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

    return (
        <section className="space-y-5">
            <article className="px-1 py-1">
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
                    <h3 className="text-3xl font-bold">Notifications</h3>
                    <p className="theme-muted text-sm">{unreadCount} unread</p>
                    <button
                        type="button"
                        onClick={onMarkAllRead}
                        disabled={unreadCount === 0}
                        className="theme-soft-button rounded-full px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Mark all as read
                    </button>
                </div>
            </article>

            {notifications.length === 0 ? (
                <div className="px-2 py-3">
                    <div className="flex items-center gap-2">
                        <Bell size={18} />
                        <p className="font-semibold">No notifications yet</p>
                    </div>
                    <p className="theme-muted mt-2 text-sm">
                        New alerts will appear here automatically.
                    </p>
                </div>
            ) : (
                <div className="divide-y divide-[color:var(--app-border)]">
                    {notifications.map((item) => (
                        <article key={item.id} className="py-4 first:pt-1">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h4 className="font-semibold">{item.title}</h4>
                                        <span className="theme-chip rounded-full px-2 py-0.5 text-[11px] uppercase">
                                            {item.type}
                                        </span>
                                        {!item.read && (
                                            <span className="theme-price text-[11px] font-semibold uppercase tracking-[0.12em]">
                                                New
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="theme-muted flex items-center gap-1 text-xs whitespace-nowrap">
                                            <Clock3 size={12} />
                                            {formatTime(item.createdAt)}
                                        </p>
                                        {item.read ? (
                                            <span className="theme-muted inline-flex items-center gap-1 text-xs font-semibold">
                                                <CheckCheck size={13} />
                                                Read
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => onMarkOneRead(item.id)}
                                                className="theme-soft-button inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs"
                                            >
                                                <Check size={13} />
                                                Mark read
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <p className="theme-muted mt-1 text-sm">{item.message}</p>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}
