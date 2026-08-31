import { useEffect, useState } from "react";
import { api } from "../../../utils/apiClient";
import { showToast } from "../../../utils/toast";
import { Bell, Check, Trash2, Calendar } from "lucide-react";
import NotificationSoundPicker from "../../../components/NotificationSoundPicker";

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
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (err) {
      // ignore
    }
  };

  if (loading) {
    return <div className="py-12 text-center theme-muted">Loading notifications...</div>;
  }

  return (
    <div className="space-y-6 text-left">
      <header className="theme-panel rounded-[32px] p-6">
        <p className="theme-accent-text text-xs font-semibold uppercase tracking-[0.32em]">Updates & Reminders</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Notifications</h1>
        <p className="theme-muted mt-2 text-sm leading-relaxed max-w-xl">
          Stay informed about your reward points credits, Khata balance adjustments, and payments at dining partners.
        </p>
      </header>

      {notifications.length === 0 ? (
        <div className="theme-panel rounded-[32px] p-10 text-center">
          <p className="text-base font-semibold">No notifications yet</p>
          <p className="theme-muted mt-1.5 text-xs">
            We will notify you here when you earn points or receive balance reminders.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((item) => (
            <div
              key={item.id}
              onClick={() => !item.read && handleMarkAsRead(item.id)}
              className={`rounded-2xl border p-5 flex gap-4 transition duration-150 relative cursor-pointer ${
                item.read
                  ? "border-white/5 bg-black/10 opacity-70"
                  : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
              }`}
            >
              {!item.read && (
                <span className="absolute top-4 left-4 h-2 w-2 rounded-full bg-emerald-400" />
              )}
              <div className="flex-1 min-w-0 pl-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-bold text-sm text-white/90">
                    {item.title} <span className="text-white/40 font-normal">at {item.restaurant?.name}</span>
                  </h4>
                  <div className="flex items-center gap-1.5 text-[10px] theme-muted whitespace-nowrap">
                    <Calendar size={10} />
                    {formatDate(item.createdAt)}
                  </div>
                </div>
                <p className="theme-muted mt-2 text-xs leading-relaxed">{item.message}</p>
              </div>

              {!item.read && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkAsRead(item.id);
                  }}
                  className="theme-soft-button inline-flex h-7 w-7 items-center justify-center rounded-lg hover:bg-emerald-500/10 hover:text-emerald-400 transition"
                  title="Mark as read"
                >
                  <Check size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <NotificationSoundPicker />
    </div>
  );
}
