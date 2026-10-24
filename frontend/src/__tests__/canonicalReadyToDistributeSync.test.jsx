import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import Server from "../pages/Server.jsx";
import { LanguageProvider } from "../context/LanguageContext.jsx";
import { RestaurantThemeProvider } from "../context/ThemeContext.jsx";
import { RestaurantContextProvider } from "../context/RestaurantContext.jsx";
import { CartProvider } from "../context/CartContext.jsx";

const mockTables = [
  {
    id: 1,
    tableNo: "1",
    seats: 4,
    isOccupied: true,
    isBlocked: false,
    section: "Main Hall",
    assignedWaiterId: 101,
    assignedWaiterName: "Server Rahul",
    activeOrders: [],
  },
];

// Socket event registry to simulate realtime updates
let socketListeners = {};
const mockSocket = {
  on: vi.fn((event, cb) => {
    socketListeners[event] = cb;
  }),
  off: vi.fn((event) => {
    delete socketListeners[event];
  }),
  emit: vi.fn(),
  connected: true,
};

vi.mock("../context/AuthContext.jsx", () => ({
  useAuth: () => ({
    user: { id: 1, restaurantId: 1, name: "Server Rahul", role: "SERVER" },
    logout: vi.fn(),
  }),
}));

vi.mock("../context/StaffSocketContext.jsx", () => ({
  useStaffSocket: () => ({
    socket: mockSocket,
    isConnected: true,
  }),
}));

vi.mock("../context/SocketContext.jsx", () => ({
  useSocket: () => ({
    socket: mockSocket,
    isConnected: true,
  }),
}));

let mockReadyItems = [];
let mockRefreshRunner = vi.fn();
let mockRefreshKots = vi.fn();

vi.mock("../hooks/useCachedGet", () => ({
  default: (url) => {
    const urlStr = String(url || "");
    if (urlStr.includes("/food-runner-items") || urlStr.includes("/ready-distribution-items")) {
      return {
        data: { success: true, items: mockReadyItems },
        loading: false,
        refresh: mockRefreshRunner,
      };
    }
    if (urlStr.includes("/tables")) {
      return { data: { tables: mockTables }, loading: false, refresh: vi.fn() };
    }
    if (urlStr.includes("/menu")) {
      return { data: { items: [] }, loading: false, refresh: vi.fn() };
    }
    if (urlStr.includes("/reservations")) {
      return { data: { reservations: [] }, loading: false, refresh: vi.fn() };
    }
    if (urlStr.includes("/kots")) {
      return { data: { kots: [] }, loading: false, refresh: mockRefreshKots };
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

const renderServer = () => {
  return render(
    <MemoryRouter initialEntries={["/server"]}>
      <RestaurantContextProvider>
        <RestaurantThemeProvider>
          <LanguageProvider>
            <CartProvider>
              <Server />
            </CartProvider>
          </LanguageProvider>
        </RestaurantThemeProvider>
      </RestaurantContextProvider>
    </MemoryRouter>
  );
};

describe("Tiffzy Canonical Ready-to-Distribute Sync — Cross-Page & Realtime Verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socketListeners = {};
    mockReadyItems = [];
  });

  it("1. Header count strictly equals canonical ready queue length (Header === 0 when 0 items ready)", () => {
    mockReadyItems = [];
    renderServer();

    const headerBtn = screen.getByTitle("Kitchen Pass / Ready to Distribute");
    expect(headerBtn).toHaveTextContent("Ready to Distribute");
    expect(headerBtn).toHaveTextContent("0");
  });

  it("2. Multiple READY items: Header count equals queue length and lists exact canonical KOTItem IDs", () => {
    mockReadyItems = [
      {
        id: 304,
        kotItemId: 304,
        orderItemId: 1001,
        kotId: 50,
        orderId: 100,
        restaurantId: 1,
        tableNo: "1",
        itemName: "Tandoori Paneer Pizza",
        qty: 1,
        status: "READY",
        stationName: "Pizza Station",
        waiterName: "Server Rahul",
      },
      {
        id: 305,
        kotItemId: 305,
        orderItemId: 1002,
        kotId: 50,
        orderId: 100,
        restaurantId: 1,
        tableNo: "1",
        itemName: "Cold Brew Coffee",
        qty: 2,
        status: "READY",
        stationName: "Beverage Bar",
        waiterName: "Server Rahul",
      },
    ];

    renderServer();

    // Header must show 2
    const headerBtn = screen.getByTitle("Kitchen Pass / Ready to Distribute");
    expect(headerBtn).toHaveTextContent("Ready to Distribute");
    expect(headerBtn).toHaveTextContent("2");

    // Both items must be visible in the distribution queue
    expect(screen.getByText("Tandoori Paneer Pizza")).toBeInTheDocument();
    expect(screen.getByText("Cold Brew Coffee")).toBeInTheDocument();

    // Verify canonical KOTItem ID badges
    expect(screen.getByText(/Item #304/i)).toBeInTheDocument();
    expect(screen.getByText(/Item #305/i)).toBeInTheDocument();
  });

  it("3. Partial order: 1 item READY, 2 items PREPARING/PENDING -> Server sees exactly 1 item and header count 1", () => {
    // Only the READY item is returned in the canonical ready queue
    mockReadyItems = [
      {
        id: 304,
        kotItemId: 304,
        orderItemId: 1001,
        kotId: 50,
        orderId: 100,
        restaurantId: 1,
        tableNo: "1",
        itemName: "Tandoori Paneer Pizza",
        qty: 1,
        status: "READY",
        stationName: "Pizza Station",
      },
    ];

    renderServer();

    const headerBtn = screen.getByTitle("Kitchen Pass / Ready to Distribute");
    expect(headerBtn).toHaveTextContent("Ready to Distribute");
    expect(headerBtn).toHaveTextContent("1");

    expect(screen.getByText("Tandoori Paneer Pizza")).toBeInTheDocument();
    expect(screen.queryByText("Cold Brew Coffee")).not.toBeInTheDocument();
  });

  it("4. Server distributes item: PUT /api/v1/staff/food-runner-items/:itemId/delivered called with exact canonical ID", async () => {
    mockReadyItems = [
      {
        id: 304,
        kotItemId: 304,
        orderItemId: 1001,
        kotId: 50,
        orderId: 100,
        restaurantId: 1,
        tableNo: "1",
        itemName: "Tandoori Paneer Pizza",
        qty: 1,
        status: "READY",
      },
    ];

    renderServer();

    const distributeBtn = screen.getByRole("button", { name: /Distributed/i });
    fireEvent.click(distributeBtn);

    await waitFor(() => {
      expect(axios.put).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/staff/food-runner-items/304/delivered")
      );
    });
  });

  it("5. Duplicate menu items in same order remain distinct with separate canonical KOTItem IDs", () => {
    mockReadyItems = [
      {
        id: 401,
        kotItemId: 401,
        orderItemId: 1005,
        kotId: 51,
        orderId: 101,
        restaurantId: 1,
        tableNo: "1",
        itemName: "Chocolate Lava Cake",
        qty: 1,
        status: "READY",
      },
      {
        id: 402,
        kotItemId: 402,
        orderItemId: 1006,
        kotId: 51,
        orderId: 101,
        restaurantId: 1,
        tableNo: "1",
        itemName: "Chocolate Lava Cake",
        qty: 1,
        status: "READY",
      },
    ];

    renderServer();

    const headerBtn = screen.getByTitle("Kitchen Pass / Ready to Distribute");
    expect(headerBtn).toHaveTextContent("Ready to Distribute");
    expect(headerBtn).toHaveTextContent("2");

    expect(screen.getByText(/Item #401/i)).toBeInTheDocument();
    expect(screen.getByText(/Item #402/i)).toBeInTheDocument();
    expect(screen.getAllByText("Chocolate Lava Cake").length).toBe(2);
  });

  it("6. Realtime Socket.IO: kitchen:item_ready dynamically adds item to queue and increments header count", async () => {
    mockReadyItems = [];
    renderServer();

    const headerBtn = screen.getByTitle("Kitchen Pass / Ready to Distribute");
    expect(headerBtn).toHaveTextContent("0");

    // Chef marks item 555 ready, triggering socket event
    expect(socketListeners["kitchen:item_ready"]).toBeDefined();
    await waitFor(() => {
      socketListeners["kitchen:item_ready"]({
        item: {
          id: 555,
          kotItemId: 555,
          orderItemId: 2001,
          kotId: 60,
          orderId: 200,
          restaurantId: 1,
          tableNo: "1",
          itemName: "Butter Naan",
          qty: 2,
          status: "READY",
        },
      });
    });

    await waitFor(() => {
      expect(headerBtn).toHaveTextContent("1");
      expect(screen.getByText("Butter Naan")).toBeInTheDocument();
      expect(screen.getByText(/Item #555/i)).toBeInTheDocument();
    });
  });

  it("7. Realtime Socket.IO: food:delivered removes item from queue and decrements header count", async () => {
    mockReadyItems = [
      {
        id: 555,
        kotItemId: 555,
        orderItemId: 2001,
        kotId: 60,
        orderId: 200,
        restaurantId: 1,
        tableNo: "1",
        itemName: "Butter Naan",
        qty: 2,
        status: "READY",
      },
    ];

    renderServer();
    const headerBtn = screen.getByTitle("Kitchen Pass / Ready to Distribute");
    expect(headerBtn).toHaveTextContent("1");

    // Waiter distributes item 555, triggering food:delivered
    expect(socketListeners["food:delivered"]).toBeDefined();
    await waitFor(() => {
      socketListeners["food:delivered"]({ itemId: 555 });
    });

    await waitFor(() => {
      expect(headerBtn).toHaveTextContent("0");
      expect(screen.queryByText("Butter Naan")).not.toBeInTheDocument();
    });
  });

  it("8. Socket.IO reconnect: Re-fetches canonical state from backend authority", async () => {
    mockReadyItems = [];
    renderServer();

    expect(socketListeners["connect"]).toBeDefined();
    await waitFor(() => {
      socketListeners["connect"]();
    });

    expect(mockRefreshRunner).toHaveBeenCalled();
    expect(mockRefreshKots).toHaveBeenCalled();
  });
});
