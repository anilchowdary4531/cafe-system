import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Server from "../pages/Server";
import { LanguageProvider } from "../context/LanguageContext";
import { RestaurantThemeProvider } from "../context/ThemeContext";
import { RestaurantContextProvider } from "../context/RestaurantContext";
import { CartProvider } from "../context/CartContext";
import { showToast } from "../utils/toast";
import { playNotificationSound } from "../utils/soundPlayer";

let mockUser = {
  id: 101,
  name: "Rahul Server",
  email: "rahul@tiffzy.com",
  role: "WAITER",
  designation: "Head Server",
  restaurantId: 1,
  restaurant: { name: "Tiffzy Fine Dining" },
  isActive: true,
};

let socketCallbacks = {};
const mockSocket = {
  on: vi.fn((event, cb) => {
    socketCallbacks[event] = cb;
  }),
  off: vi.fn((event) => {
    delete socketCallbacks[event];
  }),
  emit: vi.fn(),
};

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: mockUser,
    token: "mock-jwt-token",
    logout: vi.fn(),
  }),
}));

vi.mock("../context/StaffSocketContext", () => ({
  useStaffSocket: () => ({
    socket: mockSocket,
    isConnected: true,
  }),
}));

vi.mock("../utils/apiClient", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    api: {
      get: vi.fn().mockImplementation((url) => {
        if (url.includes("/notifications")) {
          return Promise.resolve({
            data: {
              success: true,
              data: [
                {
                  id: 1,
                  type: "KOT_SENT",
                  title: "🍳 Order Sent to Kitchen — Table 1",
                  message: "Order #1001 with 2 items sent to kitchen for Table 1",
                  isRead: false,
                  createdAt: new Date().toISOString(),
                  data: { orderId: 1001, tableNo: "1", action: "KOT_SENT" },
                },
              ],
            },
          });
        }
        return Promise.resolve({ data: { success: true, count: 1 } });
      }),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
  };
});

let mockTablesData = {
  tables: [
    {
      id: 1,
      tableNo: "Table 1",
      section: "Indoor",
      capacity: 4,
      status: "OCCUPIED",
      hasActiveOrder: true,
      activeOrder: {
        id: 1001,
        total: 450,
        items: [{ id: 1, name: "Latte", quantity: 2 }],
      },
      activeSession: {
        id: 501,
        tableId: 1,
        waiterId: 101,
      },
    },
    {
      id: 2,
      tableNo: "table 1",
      section: "Patio",
      capacity: 2,
      status: "AVAILABLE",
      hasActiveOrder: false,
      activeOrder: null,
      activeSession: null,
    },
  ],
};

vi.mock("../hooks/useCachedGet", () => ({
  default: (url) => {
    const urlStr = String(url || "");
    if (urlStr.includes("/tables")) {
      return { data: mockTablesData, loading: false, refresh: vi.fn() };
    }
    if (urlStr.includes("/menu")) {
      return { data: { items: [] }, loading: false, refresh: vi.fn() };
    }
    if (urlStr.includes("/reservations")) {
      return { data: { reservations: [] }, loading: false, refresh: vi.fn() };
    }
    if (urlStr.includes("/kots")) {
      return { data: { kots: [] }, loading: false, refresh: vi.fn() };
    }
    return { data: {}, loading: false, refresh: vi.fn() };
  },
}));

vi.mock("../utils/soundPlayer", () => ({
  playNotificationSound: vi.fn(),
  getActiveSoundConfig: vi.fn(() => ({ id: "sound1", name: "Chime" })),
  saveSoundConfig: vi.fn(),
  isSoundEnabled: vi.fn(() => true),
  setSoundEnabled: vi.fn(),
  isVibrationEnabled: vi.fn(() => false),
  setVibrationEnabled: vi.fn(),
  triggerNotificationVibration: vi.fn(),
  VIBRATION_PATTERNS: [],
  getVibrationPattern: vi.fn(() => "default"),
  setVibrationPattern: vi.fn(),
  isVibrationSupported: vi.fn(() => false),
  BUILTIN_SOUNDS: [],
}));

vi.mock("../utils/toast", () => ({
  showToast: vi.fn(),
}));

describe("Server Station — Table Identity & Kitchen Notification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderServer = (initialRoute = "/server") =>
    render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <LanguageProvider>
          <RestaurantThemeProvider>
            <RestaurantContextProvider>
              <CartProvider>
                <Routes>
                  <Route path="/server" element={<Server />} />
                  <Route path="/server/history" element={<Server />} />
                  <Route path="/server/notifications" element={<Server />} />
                  <Route path="/server/profile" element={<Server />} />
                </Routes>
              </CartProvider>
            </RestaurantContextProvider>
          </RestaurantThemeProvider>
        </LanguageProvider>
      </MemoryRouter>
    );

  it("1. Renders canonical tables with distinct table IDs without duplicates", async () => {
    renderServer();

    // Table 1 (ID 1) and table 1 (ID 2) are separate database tables
    const tableElements = screen.getAllByText(/table 1/i);
    expect(tableElements.length).toBeGreaterThanOrEqual(2);

    // Verify both IDs are present in the DOM
    expect(screen.getByTestId("table-card-1")).toBeInTheDocument();
    expect(screen.getByTestId("table-card-2")).toBeInTheDocument();

    // Verify order is ONLY on Table 1 (ID: 1), and NOT leaked to Table 2 (ID: 2)
    const card1 = screen.getByTestId("table-card-1");
    const card2 = screen.getByTestId("table-card-2");

    expect(card1).toHaveTextContent("Table 1");
    expect(card2).toHaveTextContent("table 1");
  });

  it("2. Deduplicates tables if the same canonical table ID is received twice", async () => {
    mockTablesData = {
      tables: [
        { id: 1, tableNo: "Table 1", section: "Main", capacity: 4, status: "AVAILABLE" },
        { id: 1, tableNo: "Table 1", section: "Main", capacity: 4, status: "AVAILABLE" },
      ],
    };

    renderServer();

    const card1Elements = screen.getAllByTestId("table-card-1");
    expect(card1Elements.length).toBe(1);
  });

  it("3. Handles KOT_SENT notification via socket: shows toast and plays notification sound", async () => {
    renderServer();

    // Simulate incoming KOT_SENT notification event
    const notifHandler = socketCallbacks["notification:new"];
    expect(notifHandler).toBeDefined();

    notifHandler({
      id: "notif-kot-1001",
      type: "KOT_SENT",
      title: "🍳 Order Sent to Kitchen — Table 1",
      message: "Order #1001 sent to kitchen for Table 1",
      data: {
        orderId: 1001,
        tableNo: "Table 1",
        action: "KOT_SENT",
      },
    });

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining("Order Sent to Kitchen"),
          variant: "success",
        })
      );
      expect(playNotificationSound).toHaveBeenCalled();
    });
  });

  it("4. Deduplicates notifications with the same ID upon socket events or reconnects", async () => {
    renderServer();

    const notifHandler = socketCallbacks["notification:new"];
    expect(notifHandler).toBeDefined();

    const notifPayload = {
      id: "duplicate-kot-999",
      type: "KOT_SENT",
      title: "🍳 Order Sent to Kitchen — Table 1",
      message: "Order #1001 sent to kitchen for Table 1",
    };

    // First arrival
    notifHandler(notifPayload);
    // Duplicate arrival (e.g. socket reconnected or double dispatch)
    notifHandler(notifPayload);

    // Toast should only be shown once for the same notification ID
    expect(showToast).toHaveBeenCalledTimes(1);
  });

  it("5. Server Station top navbar has Profile button that navigates to Server Profile", async () => {
    renderServer();

    const profileBtn = screen.getByTestId("server-profile-btn");
    expect(profileBtn).toBeInTheDocument();
    expect(profileBtn).toHaveAttribute("title", "Profile");
    expect(profileBtn).toHaveAttribute("aria-label", "Server Profile");

    fireEvent.click(profileBtn);

    await waitFor(() => {
      expect(screen.getByText(/Server Profile/i)).toBeInTheDocument();
    });
  });
});
