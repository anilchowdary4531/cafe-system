import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Kitchen from "../pages/Kitchen";
import { api } from "../utils/apiClient";

// Mock dependencies
let mockCurrentUser = null;
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: mockCurrentUser,
    token: "mock-token",
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
    connected: true,
  }),
}));

vi.mock("../utils/apiClient", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock("../utils/toast", () => ({
  showToast: vi.fn(),
}));

vi.mock("../utils/soundPlayer", () => ({
  playNotificationSound: vi.fn(),
}));

describe("Senior Chef Whole-Kitchen History Test Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocketHandlers = {};

    mockCurrentUser = {
      id: 99,
      name: "Executive Chef Vikram",
      role: "CHEF",
      designation: "Senior Chef",
      restaurantId: 1,
      restaurant: { id: 1, name: "Cafe King" },
    };

    // Default mock responses
    api.get.mockImplementation((url, config) => {
      if (url.includes("/stations")) {
        return Promise.resolve({ data: { stations: [] } });
      }
      if (url.includes("/kots") && !url.includes("/history")) {
        return Promise.resolve({
          data: {
            kots: [
              {
                id: 101,
                kotNo: "KOT-101",
                tableNo: "4",
                status: "PREPARING",
                priority: "NORMAL",
                createdAt: new Date().toISOString(),
                estimatedPrepTimeMinutes: 15,
                items: [
                  { id: 201, itemName: "Classic Connect", qty: 1, status: "PREPARING", assignedChefId: 14, assignedChefName: "Chef R14" },
                ],
              },
            ],
          },
        });
      }
      if (url.includes("/kitchen/config")) {
        return Promise.resolve({ data: { ok: true, mode: "DISPATCHER", scope: "ITEMS" } });
      }
      if (url.includes("/kitchen/workload")) {
        return Promise.resolve({
          data: {
            ok: true,
            chefs: [
              { id: 14, name: "Chef R14", designation: "Line Chef", active: true, assigned: 2, capacity: 5 },
              { id: 15, name: "Chef R15", designation: "Line Chef", active: true, assigned: 1, capacity: 5 },
              { id: 16, name: "Chef R16", designation: "Line Chef", active: true, assigned: 0, capacity: 5 },
            ],
          },
        });
      }
      if (url.includes("/kitchen/history")) {
        return Promise.resolve({
          data: {
            ok: true,
            items: [
              {
                id: 301,
                orderItemId: 1625,
                menuItemId: 401,
                orderId: 1460,
                orderNo: "ORD-1460",
                tableNo: "Table 4",
                kotId: 428,
                kotNumber: "KOT-428",
                kotNo: "KOT-428",
                itemName: "Naatu Kodi with chitti Gaarelu",
                name: "Naatu Kodi with chitti Gaarelu",
                quantity: 1,
                qty: 1,
                priority: "NORMAL",
                status: "READY",
                assignmentSource: "DISPATCHED",
                assignedChefId: 14,
                assignedChefName: "Cafe King Chef R14",
                completedTime: "09:42 AM",
                prepTimeMinutes: 14,
                dateKey: "2026-10-24",
                dateHeading: "TODAY • October 24, 2026",
              },
              {
                id: 302,
                orderItemId: 1626,
                menuItemId: 402,
                orderId: 1460,
                orderNo: "ORD-1460",
                tableNo: "Table 4",
                kotId: 427,
                kotNumber: "KOT-427",
                kotNo: "KOT-427",
                itemName: "Classic Connect",
                name: "Classic Connect",
                quantity: 2,
                qty: 2,
                priority: "NORMAL",
                status: "SERVED",
                assignmentSource: "SELF_PICKED",
                assignedChefId: 15,
                assignedChefName: "Cafe King Chef R15",
                completedTime: "09:18 AM",
                prepTimeMinutes: 12,
                dateKey: "2026-10-24",
                dateHeading: "TODAY • October 24, 2026",
              },
            ],
            groupedByDate: [
              {
                dateKey: "2026-10-24",
                dateHeading: "TODAY • October 24, 2026",
                items: [
                  {
                    id: 301,
                    orderItemId: 1625,
                    menuItemId: 401,
                    orderId: 1460,
                    orderNo: "ORD-1460",
                    tableNo: "Table 4",
                    kotId: 428,
                    kotNumber: "KOT-428",
                    kotNo: "KOT-428",
                    itemName: "Naatu Kodi with chitti Gaarelu",
                    name: "Naatu Kodi with chitti Gaarelu",
                    quantity: 1,
                    qty: 1,
                    priority: "NORMAL",
                    status: "READY",
                    assignmentSource: "DISPATCHED",
                    assignedChefId: 14,
                    assignedChefName: "Cafe King Chef R14",
                    completedTime: "09:42 AM",
                    prepTimeMinutes: 14,
                    dateKey: "2026-10-24",
                    dateHeading: "TODAY • October 24, 2026",
                  },
                  {
                    id: 302,
                    orderItemId: 1626,
                    menuItemId: 402,
                    orderId: 1460,
                    orderNo: "ORD-1460",
                    tableNo: "Table 4",
                    kotId: 427,
                    kotNumber: "KOT-427",
                    kotNo: "KOT-427",
                    itemName: "Classic Connect",
                    name: "Classic Connect",
                    quantity: 2,
                    qty: 2,
                    priority: "NORMAL",
                    status: "SERVED",
                    assignmentSource: "SELF_PICKED",
                    assignedChefId: 15,
                    assignedChefName: "Cafe King Chef R15",
                    completedTime: "09:18 AM",
                    prepTimeMinutes: 12,
                    dateKey: "2026-10-24",
                    dateHeading: "TODAY • October 24, 2026",
                  },
                ],
              },
            ],
            summary: {
              completedItems: 125,
              completedKots: 48,
              activeChefs: 6,
              avgPrepTimeMinutes: 14,
              overdueCompletions: 5,
            },
            pagination: {
              page: 1,
              limit: 20,
              totalCount: 125,
              totalPages: 7,
              hasMore: true,
            },
            timezone: "Asia/Kolkata",
          },
        });
      }
      return Promise.resolve({ data: {} });
    });
  });

  it("1. Renders Command Center by default with COMMAND CENTER and HISTORY tabs", async () => {
    render(
      <MemoryRouter initialEntries={["/kitchen"]}>
        <Routes>
          <Route path="/kitchen" element={<Kitchen />} />
          <Route path="/kitchen/history" element={<Kitchen />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId("tab-command-center")).toBeInTheDocument();
    expect(screen.getByTestId("tab-kitchen-history")).toBeInTheDocument();
    expect(screen.getByText("Senior Chef Command Center")).toBeInTheDocument();
  });

  it("2. Switches to Senior Chef History view on HISTORY tab click", async () => {
    render(
      <MemoryRouter initialEntries={["/kitchen"]}>
        <Routes>
          <Route path="/kitchen" element={<Kitchen />} />
          <Route path="/kitchen/history" element={<Kitchen />} />
        </Routes>
      </MemoryRouter>
    );

    const historyTab = screen.getByTestId("tab-kitchen-history");
    fireEvent.click(historyTab);

    await waitFor(() => {
      expect(screen.getByTestId("senior-chef-history-container")).toBeInTheDocument();
    });

    expect(screen.getByText("Whole-Kitchen Completed Preparation History")).toBeInTheDocument();
  });

  it("3. Displays 5 authoritative operational summary metrics in History", async () => {
    render(
      <MemoryRouter initialEntries={["/kitchen/history"]}>
        <Routes>
          <Route path="/kitchen/history" element={<Kitchen />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("senior-chef-history-container")).toBeInTheDocument();
    });

    expect(screen.getByTestId("summary-completed-items")).toHaveTextContent("125");
    expect(screen.getByTestId("summary-completed-kots")).toHaveTextContent("48");
    expect(screen.getByTestId("summary-active-chefs")).toHaveTextContent("6");
    expect(screen.getByTestId("summary-avg-prep-time")).toHaveTextContent("14m");
    expect(screen.getByTestId("summary-overdue-completions")).toHaveTextContent("5");
  });

  it("4. Shows completed items across multiple chefs with chef attribution", async () => {
    render(
      <MemoryRouter initialEntries={["/kitchen/history"]}>
        <Routes>
          <Route path="/kitchen/history" element={<Kitchen />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("senior-chef-history-container")).toBeInTheDocument();
    });

    expect(screen.getByText("Naatu Kodi with chitti Gaarelu")).toBeInTheDocument();
    expect(screen.getByText("Cafe King Chef R14")).toBeInTheDocument();

    expect(screen.getByText("Classic Connect")).toBeInTheDocument();
    expect(screen.getByText("Cafe King Chef R15")).toBeInTheDocument();
  });

  it("5. Filters by Chef via the Chef dropdown filter", async () => {
    render(
      <MemoryRouter initialEntries={["/kitchen/history"]}>
        <Routes>
          <Route path="/kitchen/history" element={<Kitchen />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("history-chef-filter")).toBeInTheDocument();
    });

    const chefSelect = screen.getByTestId("history-chef-filter");
    fireEvent.change(chefSelect, { target: { value: "14" } });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining("/kitchen/history"),
        expect.objectContaining({
          params: expect.objectContaining({ chefId: "14" }),
        })
      );
    });
  });

  it("6. Filters by Date presets (Today, Yesterday, 7d, 30d)", async () => {
    render(
      <MemoryRouter initialEntries={["/kitchen/history"]}>
        <Routes>
          <Route path="/kitchen/history" element={<Kitchen />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("history-filter-yesterday")).toBeInTheDocument();
    });

    const yesterdayBtn = screen.getByTestId("history-filter-yesterday");
    fireEvent.click(yesterdayBtn);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining("/kitchen/history"),
        expect.objectContaining({
          params: expect.objectContaining({ range: "yesterday" }),
        })
      );
    });
  });

  it("7. Filters by Status (READY vs SERVED vs ALL)", async () => {
    render(
      <MemoryRouter initialEntries={["/kitchen/history"]}>
        <Routes>
          <Route path="/kitchen/history" element={<Kitchen />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("history-status-ready")).toBeInTheDocument();
    });

    const readyBtn = screen.getByTestId("history-status-ready");
    fireEvent.click(readyBtn);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining("/kitchen/history"),
        expect.objectContaining({
          params: expect.objectContaining({ status: "READY" }),
        })
      );
    });
  });

  it("8. Searches by search query input with debounce", async () => {
    render(
      <MemoryRouter initialEntries={["/kitchen/history"]}>
        <Routes>
          <Route path="/kitchen/history" element={<Kitchen />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("senior-chef-history-search")).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId("senior-chef-history-search");
    fireEvent.change(searchInput, { target: { value: "Naatu" } });

    await waitFor(
      () => {
        expect(api.get).toHaveBeenCalledWith(
          expect.stringContaining("/kitchen/history"),
          expect.objectContaining({
            params: expect.objectContaining({ search: "Naatu" }),
          })
        );
      },
      { timeout: 1000 }
    );
  });

  it("9. Pagination: clicking Load More fetches next page", async () => {
    render(
      <MemoryRouter initialEntries={["/kitchen/history"]}>
        <Routes>
          <Route path="/kitchen/history" element={<Kitchen />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("senior-chef-history-load-more")).toBeInTheDocument();
    });

    const loadMoreBtn = screen.getByTestId("senior-chef-history-load-more");
    fireEvent.click(loadMoreBtn);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining("/kitchen/history"),
        expect.objectContaining({
          params: expect.objectContaining({ page: 2 }),
        })
      );
    });
  });

  it("10. Socket event kitchen:item_ready triggers history refresh", async () => {
    render(
      <MemoryRouter initialEntries={["/kitchen/history"]}>
        <Routes>
          <Route path="/kitchen/history" element={<Kitchen />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("senior-chef-history-container")).toBeInTheDocument();
    });

    const callCountBefore = api.get.mock.calls.filter((c) => c[0].includes("/kitchen/history")).length;

    // Trigger socket event
    expect(mockSocketHandlers["kitchen:item_ready"]).toBeDefined();
    mockSocketHandlers["kitchen:item_ready"]({
      itemId: 505,
      kotId: 430,
      status: "READY",
    });

    await waitFor(() => {
      const callCountAfter = api.get.mock.calls.filter((c) => c[0].includes("/kitchen/history")).length;
      expect(callCountAfter).toBeGreaterThan(callCountBefore);
    });
  });
});
