import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Bell, Check, Calendar, ChevronRight } from "lucide-react";
import { api } from "../utils/apiClient";

import { playNotificationSound } from "../utils/soundPlayer";

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function CustomerNotificationBell({ className = "" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const dropdownRef = useRef(null);
  const prevUnreadRef = useRef(0);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get("/customer/notifications");
      const list = res.data?.notifications || [];
      const currentUnread = list.filter((n) => !n.read && !n.isRead).length;

      if (currentUnread > prevUnreadRef.current && prevUnreadRef.current !== 0) {
        playNotificationSound();
      }
      prevUnreadRef.current = currentUnread;

      setNotifications(list);
    } catch {
      // Silently handle offline or non-logged-in customers
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await api.patch(`/customer/notifications/${id}/read`).catch(() =>
        api.post(`/customer/notifications/${id}/read`)
      );
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch {
      // Ignore fallback errors
    }
  };

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        style={{ border: "none", boxShadow: "none" }}
        className="chooser-chip theme-soft-button relative inline-flex shrink-0 items-center justify-center rounded-2xl p-2.5 sm:p-3 transition-all hover:bg-white/10"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell size={18} className="text-[color:var(--app-text)]" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white shadow-md animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-3 w-80 sm:w-96 z-50 rounded-3xl border border-[var(--app-border)] bg-[color:var(--app-bg)]/95 p-4 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-amber-500" />
              <h3 className="font-bold text-sm text-[color:var(--app-text)]">Notifications</h3>
            </div>
            {unreadCount > 0 && (
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-400">
                {unreadCount} unread
              </span>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {loading && notifications.length === 0 ? (
              <div className="py-6 text-center text-xs theme-muted">Loading updates...</div>
            ) : notifications.length === 0 ? (
              <div className="py-6 text-center text-xs theme-muted">
                No notifications yet. You'll receive updates on your orders and rewards here!
              </div>
            ) : (
              notifications.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  onClick={() => !item.read && handleMarkAsRead(item.id)}
                  className={`group relative flex gap-3 rounded-2xl border p-3 text-left transition ${
                    item.read
                      ? "border-white/5 bg-black/10 opacity-70"
                      : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08] cursor-pointer"
                  }`}
                >
                  {!item.read && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-xs font-bold text-[color:var(--app-text)] truncate">
                        {item.title}
                      </h4>
                      <span className="text-[10px] theme-muted shrink-0 flex items-center gap-1">
                        <Calendar size={10} />
                        {formatDate(item.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] theme-muted leading-relaxed line-clamp-2">
                      {item.message}
                    </p>
                  </div>

                  {!item.read && (
                    <button
                      onClick={(e) => handleMarkAsRead(item.id, e)}
                      className="shrink-0 self-center rounded-lg p-1.5 text-emerald-400 hover:bg-emerald-500/20"
                      title="Mark as read"
                    >
                      <Check size={14} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="mt-3 border-t border-[var(--app-border)] pt-2 text-center">
            <Link
              to="/profile/notifications"
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center gap-1 text-xs font-bold text-amber-500 hover:text-amber-400 transition py-1"
            >
              View All Notifications <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
