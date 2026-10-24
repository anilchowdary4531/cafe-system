import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import KitchenChefDetail from "../pages/KitchenChefDetail";
import { api } from "../utils/apiClient";

// Mock dependencies
let mockCurrentUser = null;
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: mockCurrentUser,
    token: "mock-token",
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

describe("Chef Station — Date-Wise History Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocketHandlers = {};

    mockCurrentUser = {
      id: 21,
      name: "Chef Ravi",
      role: "CHEF",
      designation: "Line Chef",
      restaurantId: 1,
    };

    // Default API mocks
    api.get.mockImplementation((url, config) => {
      if (url.includes("/kitchen/config")) {
        return Promise.resolve({
          data: { ok: true, mode: "DISPATCHER", scope: "ITEMS" },
        });
      }
      if (url.includes("/assigned-items")) {
        return Promise.resolve({
          data: {
            ok: true,
            items: [
              {
                id: 101,
                kotId: 50,
                kotNumber: "KOT-500",
                tableNo: "Table 4",
                name: "Butter Naan",
                quantity: 2,
                status: "PREPARING",
                priority: "NORMAL",
              },
            ],
          },
        });
      }
      if (url.includes("/history")) {
        const range = config?.params?.range || "today";
        const page = config?.params?.page || 1;
        const search = config?.params?.search || "";

        if (search === "NonExistent") {
          return Promise.resolve({
            data: {
              ok: true,
              items: [],
              groupedByDate: [],
              pagination: { page: 1, limit: 20, totalCount: 0, totalPages: 1, hasMore: false },
            },
          });
        }

        if (page === 2) {
          return Promise.resolve({
            data: {
              ok: true,
              items: [
                {
                  id: 903,
                  kotId: 420,
                  kotNumber: "KOT-420",
                  tableNo: "Table 1",
                  name: "Garlic Naan",
                  quantity: 3,
                  status: "READY",
                  assignmentSource: "DISPATCHED",
                  completedTime: "07:30 PM",
                  dateKey: "2026-10-23",
                  dateHeading: "YESTERDAY • October 23, 2026",
                },
              ],
              groupedByDate: [
                {
                  dateKey: "2026-10-23",
                  dateHeading: "YESTERDAY • October 23, 2026",
                  items: [
                    {
                      id: 903,
                      kotId: 420,
                      kotNumber: "KOT-420",
                      tableNo: "Table 1",
                      name: "Garlic Naan",
                      quantity: 3,
                      status: "READY",
                      assignmentSource: "DISPATCHED",
                      completedTime: "07:30 PM",
                    },
                  ],
                },
              ],
              pagination: { page: 2, limit: 1, totalCount: 3, totalPages: 3, hasMore: true },
            },
          });
        }

        return Promise.resolve({
          data: {
            ok: true,
            items: [
              {
                id: 901,
                orderItemId: 1625,
                kotId: 428,
                kotNumber: "KOT-428",
                tableNo: "Table 4",
                name: "Naatu Kodi with chitti Gaarelu",
                quantity: 1,
                status: "READY",
                assignmentSource: "DISPATCHED",
                completedTime: "09:42 AM",
                prepTimeMinutes: 14,
                priority: "HIGH",
                dateKey: "2026-10-24",
                dateHeading: "TODAY • October 24, 2026",
              },
              {
                id: 902,
                orderItemId: 1626,
                kotId: 428,
                kotNumber: "KOT-428",
                tableNo: "Table 4",
                name: "Naatu Kodi with chitti Gaarelu",
                quantity: 2,
                variantName: "Spicy",
                status: "SERVED",
                assignmentSource: "SELF_PICKED",
                completedTime: "09:15 AM",
                prepTimeMinutes: 20,
                priority: "NORMAL",
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
                    id: 901,
                    orderItemId: 1625,
                    kotId: 428,
                    kotNumber: "KOT-428",
                    tableNo: "Table 4",
                    name: "Naatu Kodi with chitti Gaarelu",
                    quantity: 1,
                    status: "READY",
                    assignmentSource: "DISPATCHED",
                    completedTime: "09:42 AM",
                    prepTimeMinutes: 14,
                    priority: "HIGH",
                  },
                  {
                    id: 902,
                    orderItemId: 1626,
                    kotId: 428,
                    kotNumber: "KOT-428",
                    tableNo: "Table 4",
                    name: "Naatu Kodi with chitti Gaarelu",
                    quantity: 2,
                    variantName: "Spicy",
                    status: "SERVED",
                    assignmentSource: "SELF_PICKED",
                    completedTime: "09:15 AM",
                    prepTimeMinutes: 20,
                    priority: "NORMAL",
                  },
                ],
              },
            ],
            pagination: { page: 1, limit: 2, totalCount: 3, totalPages: 2, hasMore: true },
          },
        });
      }
      return Promise.resolve({ data: { ok: true } });
    });
  });

  // 1. Navigation tabs are rendered
  it("renders both MY ASSIGNED ITEMS and HISTORY navigation tabs", async () => {
    render(
      <MemoryRouter initialEntries={["/kitchen/chef/21"]}>
        <Routes>
          <Route path="/kitchen/chef/:chefId" element={<KitchenChefDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("tab-assigned-items")).toBeInTheDocument();
      expect(screen.getByTestId("tab-chef-history")).toBeInTheDocument();
      expect(screen.getByText(/Butter Naan/i)).toBeInTheDocument();
    });
  });

  // 2. Switching to HISTORY tab displays completed items and chef identity
  it("switches to HISTORY tab and displays completed items with date-wise grouping", async () => {
    render(
      <MemoryRouter initialEntries={["/kitchen/chef/21"]}>
        <Routes>
          <Route path="/kitchen/chef/:chefId" element={<KitchenChefDetail />} />
          <Route path="/kitchen/chef/:chefId/history" element={<KitchenChefDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("tab-chef-history")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("tab-chef-history"));

    await waitFor(() => {
      expect(screen.getByTestId("chef-history-container")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /Chef History/i })).toBeInTheDocument();
      expect(screen.getAllByText(/Completed Items/i)[0]).toBeInTheDocument();
      expect(screen.getByText(/TODAY • October 24, 2026/i)).toBeInTheDocument();
      expect(screen.getByTestId("history-item-901")).toBeInTheDocument();
      expect(screen.getByTestId("history-item-902")).toBeInTheDocument();
    });
  });

  // 3. Duplicate menu items remain distinct cards with canonical details
  it("preserves separate canonical items for duplicate menu item names", async () => {
    render(
      <MemoryRouter initialEntries={["/kitchen/chef/21/history"]}>
        <Routes>
          <Route path="/kitchen/chef/:chefId/history" element={<KitchenChefDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("history-item-901")).toBeInTheDocument();
    });
    const items = screen.getAllByText(/Naatu Kodi with chitti Gaarelu/i);
    expect(items.length).toBe(2);
    expect(screen.getByText("1x")).toBeInTheDocument();
    expect(screen.getByText("2x")).toBeInTheDocument();
    expect(screen.getByText(/09:42 AM/)).toBeInTheDocument();
    expect(screen.getByText(/09:15 AM/)).toBeInTheDocument();
  });

  // 4. Date filtering buttons trigger API with correct range
  it("allows filtering completed history by date range presets", async () => {
    render(
      <MemoryRouter initialEntries={["/kitchen/chef/21/history"]}>
        <Routes>
          <Route path="/kitchen/chef/:chefId/history" element={<KitchenChefDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("filter-yesterday")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("filter-yesterday"));

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining("/kitchen/chef/21/history"),
        expect.objectContaining({
          params: expect.objectContaining({ range: "yesterday" }),
        })
      );
    });

    fireEvent.click(screen.getByTestId("filter-7d"));

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining("/kitchen/chef/21/history"),
        expect.objectContaining({
          params: expect.objectContaining({ range: "7d" }),
        })
      );
    });
  });

  // 5. Search filtering triggers query
  it("allows searching history by keyword", async () => {
    render(
      <MemoryRouter initialEntries={["/kitchen/chef/21/history"]}>
        <Routes>
          <Route path="/kitchen/chef/:chefId/history" element={<KitchenChefDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("history-search-input")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("history-search-input"), {
      target: { value: "KOT-428" },
    });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining("/kitchen/chef/21/history"),
        expect.objectContaining({
          params: expect.objectContaining({ search: "KOT-428" }),
        })
      );
    });
  });

  // 6. Empty search result displays friendly empty state
  it("displays empty state when no items match search", async () => {
    render(
      <MemoryRouter initialEntries={["/kitchen/chef/21/history"]}>
        <Routes>
          <Route path="/kitchen/chef/:chefId/history" element={<KitchenChefDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("history-search-input")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("history-search-input"), {
      target: { value: "NonExistent" },
    });

    await waitFor(() => {
      expect(screen.getByText(/No completed items found matching "NonExistent"/i)).toBeInTheDocument();
    });
  });

  // 7. Pagination "Load More" appends records
  it("supports pagination loading additional records", async () => {
    render(
      <MemoryRouter initialEntries={["/kitchen/chef/21/history"]}>
        <Routes>
          <Route path="/kitchen/chef/:chefId/history" element={<KitchenChefDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("load-more-btn")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("load-more-btn"));

    await waitFor(() => {
      expect(screen.getByText(/Garlic Naan/i)).toBeInTheDocument();
    });
  });

  // 8. Realtime updates reload history
  it("reloads history on realtime socket event", async () => {
    render(
      <MemoryRouter initialEntries={["/kitchen/chef/21/history"]}>
        <Routes>
          <Route path="/kitchen/chef/:chefId/history" element={<KitchenChefDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("history-item-901")).toBeInTheDocument();
      expect(screen.getAllByText(/Naatu Kodi with chitti Gaarelu/i)[0]).toBeInTheDocument();
    });

    const callCountBefore = api.get.mock.calls.length;

    // Trigger realtime item status updated
    expect(mockSocketHandlers["kitchen:item_status_updated"]).toBeDefined();
    act(() => {
      mockSocketHandlers["kitchen:item_status_updated"]({ ok: true });
    });

    await waitFor(() => {
      expect(api.get.mock.calls.length).toBeGreaterThan(callCountBefore);
    });
  });

  // 9. Unauthorized chef access produces Access Denied
  it("denies access when a Line Chef tries to access another chef's station or history", async () => {
    mockCurrentUser = {
      id: 21,
      name: "Chef Ravi",
      role: "CHEF",
      designation: "Line Chef",
      restaurantId: 1,
    };

    render(
      <MemoryRouter initialEntries={["/kitchen/chef/22/history"]}>
        <Routes>
          <Route path="/kitchen/chef/:chefId/history" element={<KitchenChefDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Access Denied/i)).toBeInTheDocument();
      expect(screen.getByText(/You can only access your own assigned chef station/i)).toBeInTheDocument();
    });
  });

  // 10. Senior Chef can access station and history
  it("authorizes Senior Chef to inspect another chef's station and history", async () => {
    mockCurrentUser = {
      id: 5,
      name: "Senior Chef Vikram",
      role: "CHEF",
      designation: "Senior Chef",
      restaurantId: 1,
    };

    render(
      <MemoryRouter initialEntries={["/kitchen/chef/21/history"]}>
        <Routes>
          <Route path="/kitchen/chef/:chefId/history" element={<KitchenChefDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText(/Access Denied/i)).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /^Chef History$/i })).toBeInTheDocument();
    });
  });
});
