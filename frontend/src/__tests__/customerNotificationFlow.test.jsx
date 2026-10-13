import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CustomerNotificationBell from "../components/CustomerNotificationBell";
import CustomerNotifications from "../pages/customer/profile/CustomerNotifications";
import { CustomerNotificationProvider } from "../context/CustomerNotificationContext";
import { api } from "../utils/apiClient";
import * as soundPlayer from "../utils/soundPlayer";

vi.mock("../utils/apiClient", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock("../utils/soundPlayer", () => ({
  playNotificationSound: vi.fn(),
}));

let socketCallbacks = {};
const mockSocket = {
  on: vi.fn((event, cb) => {
    socketCallbacks[event] = cb;
  }),
  emit: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => mockSocket),
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    customerToken: "test-customer-token",
    customer: { id: 801, customerAccountId: 58, phone: "9000000001", name: "Rahul" },
  }),
}));

const renderWithContext = (ui) => {
  return render(
    <MemoryRouter>
      <CustomerNotificationProvider>
        {ui}
      </CustomerNotificationProvider>
    </MemoryRouter>
  );
};

describe("Customer Notification System End-to-End Test Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socketCallbacks = {};
    localStorage.setItem("customerToken", "test-customer-token");
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("TEST 1: Customer has 0 notifications -> Bell has NO badge, page shows 'No notifications yet'", async () => {
    api.get.mockResolvedValueOnce({
      data: { notifications: [], unreadCount: 0, total: 0 },
    });

    renderWithContext(
      <div>
        <CustomerNotificationBell />
        <CustomerNotifications />
      </div>
    );

    // Notifications page should show empty state
    await waitFor(() => {
      expect(screen.getByText("No notifications yet")).toBeInTheDocument();
    });

    // Bell should be rendered but without any badge
    const badge = screen.queryByText(/^[0-9]/);
    expect(badge).toBeNull();
  });

  it("TEST 2: Customer has 1 unread notification -> Bell shows '1', page shows 1 unread notification", async () => {
    api.get.mockResolvedValueOnce({
      data: {
        notifications: [
          {
            id: 101,
            title: "Order Placed",
            message: "Your order #101 was placed",
            isRead: false,
            createdAt: new Date().toISOString(),
          },
        ],
        unreadCount: 1,
        total: 1,
      },
    });

    renderWithContext(
      <div>
        <CustomerNotificationBell />
        <CustomerNotifications />
      </div>
    );

    await waitFor(() => {
      expect(screen.getByText("Order Placed")).toBeInTheDocument();
    });

    // Bell badge must show exactly 1
    const badge = screen.getByText("1");
    expect(badge).toBeInTheDocument();
  });

  it("TEST 3: Customer has 9 unread notifications -> Bell shows '9', page shows 9 notifications", async () => {
    const notifications = Array.from({ length: 9 }, (_, i) => ({
      id: 200 + i,
      title: `Order Update #${i + 1}`,
      message: `Status updated for order ${i + 1}`,
      isRead: false,
      createdAt: new Date().toISOString(),
    }));

    api.get.mockResolvedValueOnce({
      data: { notifications, unreadCount: 9, total: 9 },
    });

    renderWithContext(
      <div>
        <CustomerNotificationBell />
        <CustomerNotifications />
      </div>
    );

    await waitFor(() => {
      expect(screen.getByText("Order Update #1")).toBeInTheDocument();
    });

    // Bell badge must show 9
    expect(screen.getByText("9")).toBeInTheDocument();
  });

  it("TEST 4: Customer has 10 unread notifications -> Bell shows '10' (NOT '9+'), page shows 10 notifications", async () => {
    const notifications = Array.from({ length: 10 }, (_, i) => ({
      id: 300 + i,
      title: `Loyalty Alert #${i + 1}`,
      message: `You earned points ${i + 1}`,
      isRead: false,
      createdAt: new Date().toISOString(),
    }));

    api.get.mockResolvedValueOnce({
      data: { notifications, unreadCount: 10, total: 10 },
    });

    renderWithContext(
      <div>
        <CustomerNotificationBell />
        <CustomerNotifications />
      </div>
    );

    await waitFor(() => {
      expect(screen.getByText("Loyalty Alert #10")).toBeInTheDocument();
    });

    // Bell badge must show 10
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.queryByText("9+")).toBeNull();
  });

  it("TEST 4b: Customer has 100+ unread notifications -> Bell shows '99+'", async () => {
    const notifications = Array.from({ length: 105 }, (_, i) => ({
      id: 400 + i,
      title: `Notice #${i + 1}`,
      message: `Msg ${i + 1}`,
      isRead: false,
      createdAt: new Date().toISOString(),
    }));

    api.get.mockResolvedValueOnce({
      data: { notifications, unreadCount: 105, total: 105 },
    });

    renderWithContext(
      <div>
        <CustomerNotificationBell />
      </div>
    );

    await waitFor(() => {
      expect(screen.getByText("99+")).toBeInTheDocument();
    });
  });

  it("TEST 5: Open/click one unread notification -> Marks read, unread count decreases by 1, bell updates", async () => {
    api.get.mockResolvedValueOnce({
      data: {
        notifications: [
          { id: 501, title: "Notification 1", isRead: false, createdAt: new Date().toISOString() },
          { id: 502, title: "Notification 2", isRead: false, createdAt: new Date().toISOString() },
        ],
        unreadCount: 2,
        total: 2,
      },
    });

    api.patch.mockResolvedValueOnce({ data: { message: "Marked as read" } });

    renderWithContext(
      <div>
        <CustomerNotificationBell />
        <CustomerNotifications />
      </div>
    );

    await waitFor(() => {
      expect(screen.getByText("2")).toBeInTheDocument();
    });

    const notifCard = screen.getByText("Notification 1");
    fireEvent.click(notifCard);

    // Unread count in bell should immediately drop from 2 to 1
    await waitFor(() => {
      const badge = document.getElementById("customer-notification-badge");
      expect(badge).toHaveTextContent("1");
    });

    expect(api.patch).toHaveBeenCalledWith(
      "/api/notifications/501/read",
      {},
      { params: { scope: "customer" } }
    );
  });

  it("TEST 6: Click 'Mark all as read' -> All notifications become read, Bell badge disappears (0 unread)", async () => {
    api.get.mockResolvedValueOnce({
      data: {
        notifications: [
          { id: 601, title: "Notification A", isRead: false, createdAt: new Date().toISOString() },
          { id: 602, title: "Notification B", isRead: false, createdAt: new Date().toISOString() },
          { id: 603, title: "Notification C", isRead: false, createdAt: new Date().toISOString() },
        ],
        unreadCount: 3,
        total: 3,
      },
    });

    api.patch.mockResolvedValueOnce({ data: { message: "All notifications marked as read" } });

    renderWithContext(
      <div>
        <CustomerNotificationBell />
        <CustomerNotifications />
      </div>
    );

    await waitFor(() => {
      const badge = document.getElementById("customer-notification-badge");
      expect(badge).toHaveTextContent("3");
    });

    const markAllBtn = screen.getByRole("button", { name: /mark all as read/i });
    fireEvent.click(markAllBtn);

    // Bell badge should disappear completely (0 unread)
    await waitFor(() => {
      const badge = document.getElementById("customer-notification-badge");
      expect(badge).toBeNull();
    });

    expect(api.patch).toHaveBeenCalledWith(
      "/api/notifications/read-all",
      {},
      { params: { scope: "customer" } }
    );
  });

  it("TEST 7: Receive new notification through Socket.IO -> Appears on page, unread count increases, bell updates, deduplicates", async () => {
    api.get.mockResolvedValueOnce({
      data: {
        notifications: [
          { id: 701, title: "Initial Notification", isRead: false, createdAt: new Date().toISOString() },
        ],
        unreadCount: 1,
        total: 1,
      },
    });

    renderWithContext(
      <div>
        <CustomerNotificationBell />
        <CustomerNotifications />
      </div>
    );

    await waitFor(() => {
      const badge = document.getElementById("customer-notification-badge");
      expect(badge).toHaveTextContent("1");
      expect(screen.getByText("Initial Notification")).toBeInTheDocument();
    });

    // Simulate incoming Socket.IO real-time notification
    act(() => {
      if (socketCallbacks["notification:new"]) {
        socketCallbacks["notification:new"]({
          id: 702,
          title: "Realtime Order Delivered!",
          message: "Enjoy your hot meal",
          createdAt: new Date().toISOString(),
        });
      }
    });

    // Page updates with new notification and bell shows '2'
    await waitFor(() => {
      expect(screen.getByText("Realtime Order Delivered!")).toBeInTheDocument();
      const badge = document.getElementById("customer-notification-badge");
      expect(badge).toHaveTextContent("2");
    });

    // Test deduplication: receive the same notification ID 702 again
    act(() => {
      if (socketCallbacks["notification:new"]) {
        socketCallbacks["notification:new"]({
          id: 702,
          title: "Realtime Order Delivered!",
          message: "Enjoy your hot meal",
          createdAt: new Date().toISOString(),
        });
      }
    });

    // Should remain 2, not duplicate to 3
    const badge = document.getElementById("customer-notification-badge");
    expect(badge).toHaveTextContent("2");
    expect(badge).not.toHaveTextContent("3");
  });

  it("TEST 8: Refresh / re-fetch -> Notification list and unread count remain correct", async () => {
    api.get.mockResolvedValueOnce({
      data: {
        notifications: [
          { id: 801, title: "Order Ready", isRead: false, createdAt: new Date().toISOString() },
          { id: 802, title: "Welcome Reward", isRead: true, createdAt: new Date().toISOString() },
        ],
        unreadCount: 1,
        total: 2,
      },
    });

    const { unmount } = renderWithContext(
      <div>
        <CustomerNotificationBell />
        <CustomerNotifications />
      </div>
    );

    await waitFor(() => {
      const badge = document.getElementById("customer-notification-badge");
      expect(badge).toHaveTextContent("1");
      expect(screen.getByText("Order Ready")).toBeInTheDocument();
      expect(screen.getByText("Welcome Reward")).toBeInTheDocument();
    });

    unmount();

    // Re-mount (simulate browser refresh)
    api.get.mockResolvedValueOnce({
      data: {
        notifications: [
          { id: 801, title: "Order Ready", isRead: false, createdAt: new Date().toISOString() },
          { id: 802, title: "Welcome Reward", isRead: true, createdAt: new Date().toISOString() },
        ],
        unreadCount: 1,
        total: 2,
      },
    });

    renderWithContext(
      <div>
        <CustomerNotificationBell />
        <CustomerNotifications />
      </div>
    );

    await waitFor(() => {
      const badge = document.getElementById("customer-notification-badge");
      expect(badge).toHaveTextContent("1");
      expect(screen.getByText("Order Ready")).toBeInTheDocument();
      expect(screen.getByText("Welcome Reward")).toBeInTheDocument();
    });
  });

  it("TEST 9: Navigate Home -> Notifications -> Home -> Notifications keeps synced state without disappearing items", async () => {
    api.get.mockResolvedValueOnce({
      data: {
        notifications: [
          { id: 901, title: "Order Assigned", isRead: false, createdAt: new Date().toISOString() },
        ],
        unreadCount: 1,
        total: 1,
      },
    });

    const { rerender } = render(
      <MemoryRouter initialEntries={["/"]}>
        <CustomerNotificationProvider>
          <div>
            <CustomerNotificationBell />
          </div>
        </CustomerNotificationProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      const badge = document.getElementById("customer-notification-badge");
      expect(badge).toHaveTextContent("1");
    });

    // Navigate to Notifications page
    rerender(
      <MemoryRouter initialEntries={["/profile/notifications?scope=customer"]}>
        <CustomerNotificationProvider>
          <div>
            <CustomerNotificationBell />
            <CustomerNotifications />
          </div>
        </CustomerNotificationProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Order Assigned")).toBeInTheDocument();
      const badge = document.getElementById("customer-notification-badge");
      expect(badge).toHaveTextContent("1");
    });
  });

  it("TEST 10: Customer Isolation -> Requests include scope=customer, preventing mixing with staff/restaurant notifications", async () => {
    api.get.mockResolvedValueOnce({
      data: {
        notifications: [
          { id: 1001, title: "Customer Order Update", isRead: false, createdAt: new Date().toISOString() },
        ],
        unreadCount: 1,
        total: 1,
      },
    });

    renderWithContext(
      <div>
        <CustomerNotificationBell />
        <CustomerNotifications />
      </div>
    );

    await waitFor(() => {
      expect(screen.getByText("Customer Order Update")).toBeInTheDocument();
    });

    expect(api.get).toHaveBeenCalledWith(
      "/api/notifications",
      expect.objectContaining({
        params: expect.objectContaining({
          scope: "customer",
        }),
      })
    );
  });
});
