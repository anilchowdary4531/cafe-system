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
    return dt.toLocaleString();
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
            <article className="theme-hero-band rounded-3xl p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.24em] theme-muted-strong">
                            Activity Center
                        </p>
                        <h3 className="mt-1 text-3xl font-bold">Notifications</h3>
                        <p className="mt-1 text-sm theme-muted">
                            View all updates and keep track of unread messages.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="theme-chip rounded-full px-3 py-1 text-sm">
                            {unreadCount} unread
                        </span>
                        <button
                            type="button"
                            onClick={onMarkAllRead}
                            disabled={unreadCount === 0}
                            className="theme-button rounded-xl px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Mark all as read
                        </button>
                    </div>
                </div>
            </article>

            {notifications.length === 0 ? (
                <article className="theme-panel rounded-2xl p-6">
                    <div className="flex items-center gap-2">
                        <Bell size={18} />
                        <p className="font-semibold">No notifications yet</p>
                    </div>
                    <p className="theme-muted mt-2 text-sm">
                        New alerts will appear here automatically.
                    </p>
                </article>
            ) : (
                <div className="space-y-3">
                    {notifications.map((item) => (
                        <article
                            key={item.id}
                            className={`theme-panel rounded-2xl p-4 ${item.read ? "" : "border-[color:var(--app-primary)]"}`}
                        >
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-semibold">{item.title}</h4>
                                        <span className="theme-chip rounded-full px-2 py-0.5 text-[11px] uppercase">
                                            {item.type}
                                        </span>
                                        {!item.read && (
                                            <span className="theme-count-badge rounded-full px-2 py-0.5 text-[11px] font-semibold">
                                                New
                                            </span>
                                        )}
                                    </div>
                                    <p className="theme-muted mt-1 text-sm">{item.message}</p>
                                    <p className="theme-muted mt-2 flex items-center gap-1 text-xs">
                                        <Clock3 size={12} />
                                        {formatTime(item.createdAt)}
                                    </p>
                                </div>

                                {item.read ? (
                                    <span className="theme-chip inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs">
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
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}

