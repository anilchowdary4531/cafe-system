import { useEffect, useState } from "react";
import { api } from "../../../utils/apiClient";
import { showToast } from "../../../utils/toast";
import { Check, Calendar } from "lucide-react";

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
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get("/customer/notifications");
      setNotifications(res.data?.notifications || []);
    } catch (err) {
      showToast({
        title: "Error",
        message: err.response?.data?.message || "Failed to load notifications",
        variant: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (id) => {
    try {
      await api.post(`/customer/notifications/${id}/read`);
      // Update local state to mark read
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true, isRead: true } : n))
      );
    } catch {
      // ignore
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-[color:var(--app-muted)] text-sm">Loading notifications...</div>;
  }

  return (
    <div className="space-y-4 text-left">
      {notifications.length === 0 ? (
        <div className="theme-card rounded-[24px] border border-[var(--app-border)] p-10 text-center shadow-sm">
          <p className="text-base font-bold text-[color:var(--app-text)]">No notifications yet</p>
          <p className="text-[color:var(--app-muted)] mt-1.5 text-xs">
            We will notify you here when you earn points, receive balance reminders, or get order updates.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((item) => {
            const isRead = Boolean(item.read || item.isRead);
            return (
              <div
                key={item.id}
                onClick={() => !isRead && handleMarkAsRead(item.id)}
                className={`group relative flex items-center justify-between gap-4 rounded-2xl border p-4 transition duration-150 ${
                  isRead
                    ? "border-[var(--app-border)]/60 bg-black/5 opacity-75 dark:bg-white/5"
                    : "border-[var(--app-border)] bg-[color:var(--app-surface,#fff)] shadow-sm hover:border-[color:var(--app-accent)]/40 cursor-pointer"
                }`}
              >
                {!isRead && (
                  <span className="absolute top-4 left-3.5 h-2 w-2 rounded-full bg-emerald-500 shadow-sm" />
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
                      handleMarkAsRead(item.id);
                    }}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--app-border)] bg-black/5 text-[color:var(--app-text)] transition hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/30"
                    title="Mark as read"
                    aria-label="Mark as read"
                  >
                    <Check size={14} />
                  </button>
                ) : (
                  <div className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-emerald-600/60">
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
