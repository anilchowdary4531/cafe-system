import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { useCustomerNotifications } from "../context/CustomerNotificationContext";

export default function CustomerNotificationBell({ className = "" }) {
  const { unreadCount } = useCustomerNotifications();

  const badgeText = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <Link
      to="/profile/notifications?scope=customer"
      style={{ border: "none", boxShadow: "none" }}
      className={`chooser-chip theme-soft-button relative inline-flex shrink-0 items-center justify-center rounded-xl p-2 sm:p-2 transition-all hover:bg-white/10 ${className}`}
      title={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}` : "Notifications"}
      aria-label={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}` : "Notifications"}
      id="customer-notification-bell"
    >
      <Bell size={18} className="text-[color:var(--app-text)]" />
      {unreadCount > 0 && (
        <span
          id="customer-notification-badge"
          className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white shadow-md animate-pulse"
        >
          {badgeText}
        </span>
      )}
    </Link>
  );
}
