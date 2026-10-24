import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ServerHistoryView from "../components/ServerHistoryView";
import Server from "../pages/Server";
import { api } from "../utils/apiClient";
import axios from "axios";
import { LanguageProvider } from "../context/LanguageContext";
import { RestaurantThemeProvider } from "../context/ThemeContext";
import { RestaurantContextProvider } from "../context/RestaurantContext";
import { CartProvider } from "../context/CartContext";

// Mock User
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

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: mockUser,
    token: "mock-jwt-token",
    logout: vi.fn(),
  }),
}));

let mockSocketHandlers = {};
vi.mock("../context/StaffSocketContext", () => ({
  useStaffSocket: () => ({
    socket: {
      on: vi.fn((event, cb) => {
        mockSocketHandlers[event] = cb;
      }),
      off: vi.fn((event) => {
        delete mockSocketHandlers[event];
      }),
      emit: vi.fn(),
    },
    isConnected: true,
  }),
}));

vi.mock("../utils/apiClient", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    api: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
  };
});

vi.mock("../hooks/useCachedGet", () => ({
  default: (url) => {
    const urlStr = String(url || "");
    if (urlStr.includes("/tables")) {
      return { data: { tables: [] }, loading: false, refresh: vi.fn() };
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
    if (urlStr.includes("/orders")) {
      return { data: { orders: [] }, loading: false, refresh: vi.fn() };
    }
    return { data: null, loading: false, refresh: vi.fn() };
  },
}));

vi.mock("axios", () => {
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn().mockResolvedValue({ data: { success: true } }),
    put: vi.fn().mockResolvedValue({ data: { success: true } }),
    delete: vi.fn().mockResolvedValue({ data: { success: true } }),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };
  mockAxiosInstance.create = vi.fn(() => mockAxiosInstance);
  return {
    default: mockAxiosInstance,
    ...mockAxiosInstance,
  };
});

vi.mock("../utils/toast", () => ({
  showToast: vi.fn(),
}));

// Canonical mock historical items
const createMockHistoryPayload = (items = [], page = 1, hasMore = false) => {
  const groupsMap = {};
  items.forEach((it) => {
    const dateKey = it.completedDate || "2026-10-24";
    if (!groupsMap[dateKey]) {
      groupsMap[dateKey] = {
        date: dateKey,
        displayDate: dateKey === "2026-10-24" ? "Today • Oct 24, 2026" : "Yesterday • Oct 23, 2026",
        items: [],
      };
    }
    groupsMap[dateKey].items.push(it);
  });

  return {
    success: true,
    data: items,
    items,
    groupedByDate: Object.values(groupsMap),
    summary: {
      totalServedItems: items.length,
      totalServedTables: 2,
      totalServedOrders: items.length,
      totalServedKots: items.length,
    },
    pagination: {
      page,
      limit: 20,
      totalCount: items.length,
      totalPages: hasMore ? 2 : 1,
      hasMore,
    },
  };
};

const renderWithProviders = (ui, initialEntries = ["/"]) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <LanguageProvider>
        <RestaurantThemeProvider>
          <RestaurantContextProvider>
            <CartProvider>
              {ui}
            </CartProvider>
          </RestaurantContextProvider>
        </RestaurantThemeProvider>
      </LanguageProvider>
    </MemoryRouter>
  );
};

describe("Server Station — History Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocketHandlers = {};

    mockUser = {
      id: 101,
      name: "Rahul Server",
      email: "rahul@tiffzy.com",
      role: "WAITER",
      designation: "Head Server",
      restaurantId: 1,
    };

    // Default API mock implementation for Server History
    api.get.mockImplementation((url, config) => {
      if (url.includes("/server/history") || url.includes("/staff/server/history")) {
        const range = config?.params?.range || "today";
        const search = config?.params?.search || "";
        const page = config?.params?.page || 1;

        if (search === "NonExistent") {
          return Promise.resolve({
            data: createMockHistoryPayload([]),
          });
        }

        if (search === "Margherita") {
          return Promise.resolve({
            data: createMockHistoryPayload([
              {
                id: 1625,
                kotItemId: 1625,
                orderItemId: 1625,
                orderId: 501,
                orderNo: "ORD-501",
                kotId: 420,
                kotNo: "KOT-420",
                tableNo: "Table 4",
                name: "Margherita Pizza",
                quantity: 1,
                status: "SERVED",
                servedAt: "2026-10-24T09:42:00.000Z",
                completedAt: "2026-10-24T09:42:00.000Z",
                completedDate: "2026-10-24",
                formattedTime: "09:42 AM",
                chefName: "Chef Vikram",
                waiterName: "Rahul Server",
                orderSource: "DINE-IN",
              },
              {
                id: 1626,
                kotItemId: 1626,
                orderItemId: 1626,
                orderId: 501,
                orderNo: "ORD-501",
                kotId: 420,
                kotNo: "KOT-420",
                tableNo: "Table 4",
                name: "Margherita Pizza",
                quantity: 1,
                status: "SERVED",
                servedAt: "2026-10-24T09:42:00.000Z",
                completedAt: "2026-10-24T09:42:00.000Z",
                completedDate: "2026-10-24",
                formattedTime: "09:42 AM",
                chefName: "Chef Vikram",
                waiterName: "Rahul Server",
                orderSource: "DINE-IN",
              },
            ]),
          });
        }

        if (range === "yesterday") {
          return Promise.resolve({
            data: createMockHistoryPayload([
              {
                id: 1500,
                kotItemId: 1500,
                orderItemId: 1500,
                orderId: 400,
                orderNo: "ORD-400",
                kotId: 350,
                kotNo: "KOT-350",
                tableNo: "Table 2",
                name: "Butter Chicken",
                quantity: 2,
                status: "SERVED",
                servedAt: "2026-10-23T14:30:00.000Z",
                completedAt: "2026-10-23T14:30:00.000Z",
                completedDate: "2026-10-23",
                formattedTime: "02:30 PM",
                chefName: "Chef Sanjay",
                waiterName: "Rahul Server",
                orderSource: "POS",
              },
            ]),
          });
        }

        if (page === 2) {
          return Promise.resolve({
            data: createMockHistoryPayload(
              [
                {
                  id: 1630,
                  kotItemId: 1630,
                  orderItemId: 1630,
                  orderId: 505,
                  orderNo: "ORD-505",
                  kotId: 425,
                  kotNo: "KOT-425",
                  tableNo: "Table 9",
                  name: "Garlic Naan",
                  quantity: 3,
                  status: "SERVED",
                  servedAt: "2026-10-24T08:00:00.000Z",
                  completedAt: "2026-10-24T08:00:00.000Z",
                  completedDate: "2026-10-24",
                  formattedTime: "08:00 AM",
                  chefName: "Chef Ravi",
                  waiterName: "Rahul Server",
                  orderSource: "DINE-IN",
                },
              ],
              2,
              false
            ),
          });
        }

        // Default Today page 1
        return Promise.resolve({
          data: createMockHistoryPayload(
            [
              {
                id: 1620,
                kotItemId: 1620,
                orderItemId: 1620,
                orderId: 500,
                orderNo: "ORD-500",
                kotId: 418,
                kotNo: "KOT-418",
                tableNo: "Table 1",
                name: "Cold Brew Coffee",
                quantity: 1,
                status: "SERVED",
                servedAt: "2026-10-24T09:30:00.000Z",
                completedAt: "2026-10-24T09:30:00.000Z",
                completedDate: "2026-10-24",
                formattedTime: "09:30 AM",
                chefName: "Barista Alex",
                waiterName: "Rahul Server",
                orderSource: "QR",
              },
            ],
            1,
            true
          ),
        });
      }

      if (url.includes("/notifications/unread-count")) {
        return Promise.resolve({ data: { success: true, count: 0 } });
      }

      return Promise.resolve({ data: { success: true } });
    });

    axios.get.mockImplementation((url) => {
      if (url.includes("/notifications/unread-count")) {
        return Promise.resolve({ data: { success: true, count: 0 } });
      }
      return Promise.resolve({ data: { success: true } });
    });
  });

  it("1. Server History view renders and displays completed food-service activity", async () => {
    renderWithProviders(<ServerHistoryView onBackToFloorPlan={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Server Food-Service History")).toBeInTheDocument();
      expect(screen.getByText("Cold Brew Coffee")).toBeInTheDocument();
      expect(screen.getByText(/Table 1/i)).toBeInTheDocument();
      expect(screen.getByText("KOT #418")).toBeInTheDocument();
      expect(screen.getByText("Order #ORD-500")).toBeInTheDocument();
      expect(screen.getByText("SERVED")).toBeInTheDocument();
    });
  });

  it("2. Does not display PREPARING or READY items in History", async () => {
    renderWithProviders(<ServerHistoryView onBackToFloorPlan={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Cold Brew Coffee")).toBeInTheDocument();
    });

    expect(screen.queryByText("PREPARING")).not.toBeInTheDocument();
    expect(screen.queryByText("READY")).not.toBeInTheDocument();
  });

  it("3. Preserves duplicate menu items as separate canonical records", async () => {
    renderWithProviders(<ServerHistoryView onBackToFloorPlan={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("history-search-input")).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId("history-search-input");
    fireEvent.change(searchInput, { target: { value: "Margherita" } });

    await waitFor(() => {
      const items = screen.getAllByText("Margherita Pizza");
      expect(items.length).toBe(2);
      expect(screen.getByTestId("history-item-1625")).toBeInTheDocument();
      expect(screen.getByTestId("history-item-1626")).toBeInTheDocument();
    });
  });

  it("4. Filters date-wise: Yesterday filter loads yesterday's completed items", async () => {
    renderWithProviders(<ServerHistoryView onBackToFloorPlan={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Cold Brew Coffee")).toBeInTheDocument();
    });

    const yesterdayBtn = screen.getByTestId("filter-yesterday");
    fireEvent.click(yesterdayBtn);

    await waitFor(() => {
      expect(screen.getByText("Butter Chicken")).toBeInTheDocument();
      expect(screen.getByText(/Table 2/i)).toBeInTheDocument();
      expect(screen.getByText("KOT #350")).toBeInTheDocument();
      expect(screen.queryByText("Cold Brew Coffee")).not.toBeInTheDocument();
    });
  });

  it("5. Pagination: 'Load More' appends older items without replacing current items", async () => {
    renderWithProviders(<ServerHistoryView onBackToFloorPlan={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Cold Brew Coffee")).toBeInTheDocument();
    });

    const loadMoreBtn = screen.getByTestId("history-load-more-btn");
    expect(loadMoreBtn).toBeInTheDocument();

    fireEvent.click(loadMoreBtn);

    await waitFor(() => {
      expect(screen.getByText("Garlic Naan")).toBeInTheDocument();
      expect(screen.getByText("Cold Brew Coffee")).toBeInTheDocument();
    });
  });

  it("6. Realtime: socket food:delivered event triggers silent update", async () => {
    renderWithProviders(<ServerHistoryView onBackToFloorPlan={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Cold Brew Coffee")).toBeInTheDocument();
    });

    expect(mockSocketHandlers["food:delivered"]).toBeDefined();

    act(() => {
      mockSocketHandlers["food:delivered"]({
        orderId: 502,
        kotItemId: 1629,
        status: "SERVED",
      });
    });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledTimes(2);
    });
  });

  it("7. Empty state displays gracefully when no records match filter", async () => {
    renderWithProviders(<ServerHistoryView onBackToFloorPlan={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("history-search-input")).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId("history-search-input");
    fireEvent.change(searchInput, { target: { value: "NonExistent" } });

    await waitFor(() => {
      expect(screen.getByText("No completed items yet")).toBeInTheDocument();
    });
  });

  it("8. Navigation button in Server page opens History view", async () => {
    renderWithProviders(
      <Routes>
        <Route path="/server" element={<Server />} />
        <Route path="/server/history" element={<Server />} />
      </Routes>,
      ["/server"]
    );

    await waitFor(() => {
      expect(screen.getByTestId("server-history-nav-btn")).toBeInTheDocument();
    });

    const historyNavBtn = screen.getByTestId("server-history-nav-btn");
    fireEvent.click(historyNavBtn);

    await waitFor(() => {
      expect(screen.getByText("Server Food-Service History")).toBeInTheDocument();
    });
  });

  it("9. Direct route /server/history initializes in HISTORY view mode", async () => {
    renderWithProviders(
      <Routes>
        <Route path="/server" element={<Server />} />
        <Route path="/server/history" element={<Server />} />
      </Routes>,
      ["/server/history"]
    );

    await waitFor(() => {
      expect(screen.getByText("Server Food-Service History")).toBeInTheDocument();
    });
  });
});
