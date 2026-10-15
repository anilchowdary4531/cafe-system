import { Check, CheckCheck, Calendar, Bell, Loader2 } from "lucide-react";
import { useCustomerNotifications } from "../../../context/CustomerNotificationContext";

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

export default function CustomerNotifications() {
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
  } = useCustomerNotifications();

  if (loading && notifications.length === 0) {
    return (
      <div className="py-6 flex flex-col items-center justify-center gap-2 text-[color:var(--app-muted)] text-sm">
        <Loader2 size={24} className="animate-spin text-orange-500" />
        <span>Loading notifications...</span>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3.5 text-left">
      {/* Header with Unread Count & Mark All Read action */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--app-border)]/40 pb-2.5">
        <div className="flex items-center gap-2.5">
          <h2 className="text-base sm:text-lg font-bold text-[color:var(--app-text)]">
            Notifications
          </h2>
          {unreadCount > 0 && (
            <span
              id="customer-notifications-unread-pill"
              className="inline-flex items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs px-2.5 py-0.5 border border-emerald-500/20"
            >
              {unreadCount} unread
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            id="mark-all-notifications-read-btn"
            onClick={markAllAsRead}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--app-border)]/70 bg-white/60 dark:bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-[color:var(--app-text)] transition hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/30 cursor-pointer"
          >
            <CheckCheck size={14} />
            <span>Mark all as read</span>
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div
          id="customer-notifications-empty"
          className="rounded-xl border border-[color:var(--app-border)]/40 bg-white/40 dark:bg-slate-900/40 p-5 sm:p-6 text-center space-y-2"
        >
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-orange-500/10 text-[var(--app-primary)]">
            <Bell size={22} />
          </div>
          <p className="text-base font-bold text-[color:var(--app-text)]">No notifications yet</p>
          <p className="theme-muted text-xs max-w-sm mx-auto leading-relaxed">
            We will notify you here when you earn points, receive balance reminders, or get order updates.
          </p>
        </div>
      ) : (
        <div id="customer-notifications-list" className="space-y-3">
          {notifications.map((item) => {
            const isRead = Boolean(item.read || item.isRead);
            return (
              <div
                key={item.id}
                id={`notification-card-${item.id}`}
                onClick={() => !isRead && markAsRead(item.id)}
                className={`group relative flex items-center justify-between gap-4 rounded-2xl border p-4 transition duration-150 ${
                  isRead
                    ? "border-[var(--app-border)]/60 bg-black/5 opacity-75 dark:bg-white/5"
                    : "border-[var(--app-border)] bg-[color:var(--app-surface,#fff)] shadow-sm hover:border-[color:var(--app-accent)]/40 cursor-pointer"
                }`}
              >
                {!isRead && (
                  <span
                    title="Unread"
                    className="absolute top-4 left-3.5 h-2 w-2 rounded-full bg-emerald-500 shadow-sm"
                  />
                )}
                <div className="flex-1 min-w-0 pl-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-bold text-xs sm:text-sm text-[color:var(--app-text)]">
                      {item.title}{" "}
                      {item.restaurant?.name ? (
                        <span className="text-[color:var(--app-muted)] font-normal text-xs">
                          at {item.restaurant.name}
                        </span>
                      ) : null}
                    </h4>
                    <div className="flex items-center gap-1.5 text-[10.5px] text-[color:var(--app-muted)] whitespace-nowrap">
                      <Calendar size={11} />
                      {formatDate(item.createdAt)}
                    </div>
                  </div>
                  {item.message ? (
                    <p className="mt-1 text-xs text-[color:var(--app-text)] opacity-80 leading-relaxed">
                      {item.message}
                    </p>
                  ) : null}
                </div>

                {!isRead ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      markAsRead(item.id);
                    }}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--app-border)] bg-black/5 text-[color:var(--app-text)] transition hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/30"
                    title="Mark as read"
                    aria-label="Mark as read"
                  >
                    <Check size={14} />
                  </button>
                ) : (
                  <div
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-emerald-600/60"
                    title="Read"
                  >
                    <Check size={14} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
