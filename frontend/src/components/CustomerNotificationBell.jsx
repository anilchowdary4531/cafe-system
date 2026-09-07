import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { api } from "../utils/apiClient";
import { playNotificationSound } from "../utils/soundPlayer";

export default function CustomerNotificationBell({ className = "" }) {
  const [notifications, setNotifications] = useState([]);
  const prevUnreadRef = useRef(0);

  const fetchNotifications = async () => {
    try {
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
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read && !n.isRead).length;

  return (
    <Link
      to="/profile/notifications?scope=customer"
      style={{ border: "none", boxShadow: "none" }}
      className={`chooser-chip theme-soft-button relative inline-flex shrink-0 items-center justify-center rounded-2xl p-2.5 sm:p-3 transition-all hover:bg-white/10 ${className}`}
      title="Notifications"
      aria-label="Notifications"
    >
      <Bell size={18} className="text-[color:var(--app-text)]" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white shadow-md animate-pulse">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}

