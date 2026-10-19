import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { api } from "../utils/apiClient";
import { API_BASE_URL } from "../config";
import { useAuth } from "./AuthContext";
import { playNotificationSound } from "../utils/soundPlayer";

const CustomerNotificationContext = createContext({
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  refreshNotifications: async () => {},
});

export const useCustomerNotifications = () => useContext(CustomerNotificationContext);

export function CustomerNotificationProvider({ children }) {
  const { customerToken, customer } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const socketRef = useRef(null);
  const tokenRef = useRef("");
  const prevUnreadRef = useRef(0);

  const normalizeNotification = (item) => {
    const isRead = Boolean(item.isRead || item.read);
    return {
      id: item.id,
      title: item.title || "Notification",
      message: item.message || item.body || "",
      orderId: item.orderId || item.data?.orderId || null,
      restaurantId: item.restaurantId || item.data?.restaurantId || null,
      restaurant: item.restaurant || (item.data?.restaurantName ? { name: item.data.restaurantName } : null),
      notificationType: item.notificationType || item.type || "GENERAL",
      data: item.data || {},
      isRead,
      read: isRead,
      createdAt: item.createdAt || new Date().toISOString(),
    };
  };

  const fetchNotifications = useCallback(async () => {
    const activeToken = customerToken || localStorage.getItem("customerToken");
    if (!activeToken) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Call authoritative customer notifications API
      const res = await api.get("/api/notifications", {
        params: { scope: "customer", limit: 50 },
      });

      const rawList = res.data?.notifications || [];
      const normalizedList = rawList.map(normalizeNotification);

      // Accurate unread count
      const count =
        typeof res.data?.unreadCount === "number"
          ? res.data.unreadCount
          : normalizedList.filter((n) => !n.isRead).length;

      // Play sound if new unread notifications arrived
      if (count > prevUnreadRef.current && prevUnreadRef.current !== 0) {
        playNotificationSound();
      }
      prevUnreadRef.current = count;

      setNotifications(normalizedList);
      setUnreadCount(count);
    } catch (err) {
      // Gracefully handle offline or unauthenticated
      console.warn("[CustomerNotificationContext] Failed to fetch notifications:", err?.message || err);
      setError(err?.response?.data?.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, [customerToken]);

  // Initial load and customer token changes
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Periodic background refresh every 30 seconds
  useEffect(() => {
    const activeToken = customerToken || localStorage.getItem("customerToken");
    if (!activeToken) return;

    const interval = setInterval(() => {
      fetchNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, [customerToken, fetchNotifications]);

  // Real-time Socket.IO synchronization
  useEffect(() => {
    const activeToken = customerToken || localStorage.getItem("customerToken");
    if (!activeToken) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      tokenRef.current = "";
      return;
    }

    // Reuse existing socket if token is unchanged
    if (socketRef.current && tokenRef.current === activeToken) {
      return;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    tokenRef.current = activeToken;

    const socket = io(API_BASE_URL || "", {
      auth: { token: activeToken },
      transports: ["websocket", "polling"],
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      const customerId = customer?.id || customer?.customerAccountId || null;
      const phone = customer?.phone || "";
      socket.emit("authenticate", { token: activeToken });
      socket.emit("join_customer_room", {
        customerId,
        phone,
        token: activeToken,
      });
    });

    socket.on("notification:new", (newNotif) => {
      if (!newNotif || !newNotif.id) return;
      const normalized = normalizeNotification(newNotif);

      setNotifications((prev) => {
        // Deduplication check
        if (prev.some((item) => item.id === normalized.id)) {
          return prev;
        }

        if (!normalized.isRead) {
          setUnreadCount((c) => c + 1);
          playNotificationSound();
        }

        return [normalized, ...prev];
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      tokenRef.current = "";
    };
  }, [customerToken, customer]);

  // Mark single notification as read
  const markAsRead = useCallback(async (notificationId) => {
    const numId = Number(notificationId);
    if (!numId) return;

    // Optimistically update local state
    setNotifications((prev) =>
      prev.map((n) => (n.id === numId ? { ...n, isRead: true, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await api.patch(`/api/notifications/${numId}/read`, {}, {
        params: { scope: "customer" },
      });
    } catch {
      // Fallback to alternative endpoint if patch fails
      try {
        await api.post(`/api/notifications/${numId}/read`, {}, {
          params: { scope: "customer" },
        });
      } catch (err) {
        console.warn("[CustomerNotificationContext] Mark read failed:", err?.message || err);
      }
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    // Optimistically mark all read
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, isRead: true, read: true }))
    );
    setUnreadCount(0);

    try {
      await api.patch("/api/notifications/read-all", {}, {
        params: { scope: "customer" },
      });
    } catch {
      // Fallback
      try {
        await api.post("/api/notifications/read-all", {}, {
          params: { scope: "customer" },
        });
      } catch (err) {
        console.warn("[CustomerNotificationContext] Mark all read failed:", err?.message || err);
      }
    }
  }, []);

  const value = {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    refreshNotifications: fetchNotifications,
  };

  return (
    <CustomerNotificationContext.Provider value={value}>
      {children}
    </CustomerNotificationContext.Provider>
  );
}
