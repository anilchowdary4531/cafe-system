import React from "react";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import Kitchen from "../pages/Kitchen";
import ChefWorkloadPanel from "../components/ChefWorkloadPanel";

// Mock API Client
vi.mock("../utils/apiClient", () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  },
}));

// Mock Auth
let mockCurrentUser = {
  id: 10,
  name: "Chef Vikram",
  role: "CHEF",
  designation: "Senior Chef",
  restaurantId: 1,
};

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: mockCurrentUser,
    logout: vi.fn(),
  }),
}));

// Mock Staff Socket
const mockSocketHandlers = {};
const mockSocketOn = vi.fn((event, handler) => {
  mockSocketHandlers[event] = handler;
});
const mockSocketOff = vi.fn((event) => {
  delete mockSocketHandlers[event];
});
const mockSocketEmit = vi.fn();

vi.mock("../context/StaffSocketContext", () => ({
  useStaffSocket: () => ({
    socket: {
      on: mockSocketOn,
      off: mockSocketOff,
      emit: mockSocketEmit,
    },
    connected: true,
  }),
}));

vi.mock("../utils/toast", () => ({
  showToast: vi.fn(),
}));

import { api } from "../utils/apiClient";

describe("Collapsible Chef Stations & Workload Suite", () => {
  const initialChefs = [
    {
      chefId: 21,
      chefName: "Chef Ravi",
      designation: "Line Chef",
      assigned: 3,
      pending: 1,
      preparing: 2,
      ready: 0,
      capacity: 10,
    },
    {
      chefId: 22,
      chefName: "Chef Suresh",
      designation: "Line Chef",
      assigned: 1,
      pending: 1,
      preparing: 0,
      ready: 0,
      capacity: 10,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser = {
      id: 10,
      name: "Chef Vikram",
      role: "CHEF",
      designation: "Senior Chef",
      restaurantId: 1,
    };

    api.get.mockImplementation((url) => {
      if (url.includes("/kitchen/config")) {
        return Promise.resolve({
          data: { ok: true, mode: "DISPATCHER", scope: "ITEMS" },
        });
      }
      if (url.includes("/kitchen/workload")) {
        return Promise.resolve({
          data: {
            ok: true,
            chefs: initialChefs,
          },
        });
      }
      if (url.includes("/kots")) {
        return Promise.resolve({
          data: {
            kots: [
              {
                id: 428,
                kotNo: "KOT-428",
                orderId: 100,
                status: "PENDING",
                priority: "NORMAL",
                tableNo: "T4",
                createdAt: new Date().toISOString(),
                items: [
                  {
                    id: 1,
                    name: "Vankaya Baji",
                    itemName: "Vankaya Baji",
                    qty: 2,
                    quantity: 2,
                    status: "PENDING",
                    assignedChefId: null,
                    assignedChefName: null,
                  },
                ],
              },
            ],
          },
        });
      }
      if (url.includes("/stations")) {
        return Promise.resolve({ data: { stations: [{ id: 1, name: "Main Kitchen" }] } });
      }
      if (url.includes("/assigned-items")) {
        return Promise.resolve({ data: { ok: true, items: [] } });
      }
      if (url.includes("/available-work")) {
        return Promise.resolve({
          data: {
            ok: true,
            mode: "SELF_PICK",
            scope: "ITEMS",
            availableItems: [],
            availableKots: [],
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    api.put.mockResolvedValue({ data: { ok: true } });
    api.post.mockResolvedValue({ data: { ok: true } });
  });

  // 1 & 2. Collapsed by default & contents not visible initially
  it("renders /kitchen with Chef Stations & Workload collapsed by default and contents not visible", async () => {
    render(
      <MemoryRouter initialEntries={["/kitchen"]}>
        <Kitchen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Senior Chef Command Center/i)).toBeInTheDocument();
    });

    // The header toggle is visible with chef count 2
    const toggleBtn = screen.getByRole("button", { name: /Chef Stations & Workload/i });
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
    expect(within(toggleBtn).getByText("2")).toBeInTheDocument();

    // Full workload contents must NOT be visible initially
    expect(screen.queryByText("Chef Suresh")).not.toBeInTheDocument();
    expect(screen.queryByText(/Unassigned Queue/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /View All/i })).not.toBeInTheDocument();
  });

  // 3 & 4. Clicking header expands workload section and reveals cards
  it("expands workload section when header is clicked, showing chef cards and workload metrics", async () => {
    render(
      <MemoryRouter initialEntries={["/kitchen"]}>
        <Kitchen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Senior Chef Command Center/i)).toBeInTheDocument();
    });

    const toggleBtn = screen.getByRole("button", { name: /Chef Stations & Workload/i });
    expect(toggleBtn).toHaveAttribute("aria-expanded", "false");

    // Click to expand
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(toggleBtn).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByText("Chef Suresh")).toBeInTheDocument();
      expect(screen.getByText(/Unassigned Queue/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /View All/i })).toBeInTheDocument();
      expect(screen.getAllByText(/Cap: 10/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Pending/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Prep/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Ready/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  // 5 & 6. Clicking again collapses the section and toggles aria-expanded
  it("collapses workload section when clicked again, updating aria-expanded back to false", async () => {
    render(
      <MemoryRouter initialEntries={["/kitchen"]}>
        <Kitchen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Senior Chef Command Center/i)).toBeInTheDocument();
    });

    const toggleBtn = screen.getByRole("button", { name: /Chef Stations & Workload/i });

    // Expand
    fireEvent.click(toggleBtn);
    await waitFor(() => {
      expect(toggleBtn).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByText("Chef Suresh")).toBeInTheDocument();
    });

    // Collapse
    fireEvent.click(toggleBtn);
    await waitFor(() => {
      expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByText("Chef Suresh")).not.toBeInTheDocument();
      expect(screen.queryByText(/Unassigned Queue/i)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /View All/i })).not.toBeInTheDocument();
    });
  });

  // 7. Realtime workload data remains functional while collapsed
  it("keeps realtime socket updates functional while collapsed and reflects updated data upon expansion", async () => {
    render(
      <MemoryRouter initialEntries={["/kitchen"]}>
        <Kitchen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Senior Chef Command Center/i)).toBeInTheDocument();
    });

    const toggleBtn = screen.getByRole("button", { name: /Chef Stations & Workload/i });
    expect(toggleBtn).toHaveAttribute("aria-expanded", "false");

    // Simulate realtime socket workload event arriving while collapsed
    act(() => {
      if (mockSocketHandlers["kitchen:workload_updated"]) {
        mockSocketHandlers["kitchen:workload_updated"]({
          ok: true,
          restaurantId: 1,
          chefs: [
            ...initialChefs,
            {
              chefId: 23,
              chefName: "Chef Priya",
              designation: "Tandoor Chef",
              assigned: 2,
              pending: 1,
              preparing: 1,
              ready: 0,
              capacity: 8,
            },
          ],
        });
      }
    });

    // The collapsed header should now show updated count 3
    await waitFor(() => {
      expect(within(toggleBtn).getByText("3")).toBeInTheDocument();
    });

    // When Senior Chef expands, the new chef from realtime event should be rendered
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(screen.getByText("Chef Priya")).toBeInTheDocument();
      expect(screen.getByText("Tandoor Chef")).toBeInTheDocument();
      expect(screen.getByText("Chef Suresh")).toBeInTheDocument();
    });
  });

  // 8. Unassigned Work Queue remains visible and functional
  it("keeps dedicated Unassigned Work Queue visible and functional while workload is collapsed", async () => {
    render(
      <MemoryRouter initialEntries={["/kitchen"]}>
        <Kitchen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Senior Chef Command Center/i)).toBeInTheDocument();
    });

    // Unassigned Work Queue must be visible even when Chef Stations & Workload is collapsed
    expect(screen.getByText(/Unassigned Work Queue/i)).toBeInTheDocument();
    expect(screen.getByText(/1 items/i)).toBeInTheDocument();
    expect(screen.getAllByText("Vankaya Baji").length).toBeGreaterThanOrEqual(1);
  });

  // 9. Chef assignment functionality unaffected
  it("preserves chef assignment drawer functionality", async () => {
    render(
      <MemoryRouter initialEntries={["/kitchen"]}>
        <Kitchen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("KOT-428")).toBeInTheDocument();
    });

    // Find Assign button on KOT card
    const assignBtns = screen.getAllByRole("button", { name: /Assign/i });
    expect(assignBtns.length).toBeGreaterThanOrEqual(1);

    fireEvent.click(assignBtns[0]);

    await waitFor(() => {
      expect(screen.getByText(/Assign KOT #KOT-428/i)).toBeInTheDocument();
    });
  });

  // 10. Self-Pick functionality unaffected
  it("preserves Self-Pick mode toggle functionality", async () => {
    render(
      <MemoryRouter initialEntries={["/kitchen"]}>
        <Kitchen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Senior Chef Command Center/i)).toBeInTheDocument();
    });

    const selfPickBtn = screen.getByRole("button", { name: "SELF-PICK" });
    fireEvent.click(selfPickBtn);

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith(
        expect.stringContaining("/kitchen/config"),
        expect.objectContaining({ mode: "SELF_PICK" })
      );
    });
  });

  // 11. Keyboard accessibility (Enter & Space keys)
  it("supports keyboard Enter and Space navigation to toggle expand/collapse", async () => {
    render(
      <MemoryRouter initialEntries={["/kitchen"]}>
        <Kitchen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Senior Chef Command Center/i)).toBeInTheDocument();
    });

    const toggleBtn = screen.getByRole("button", { name: /Chef Stations & Workload/i });

    // Press Space key to expand
    fireEvent.keyDown(toggleBtn, { key: " " });
    await waitFor(() => {
      expect(toggleBtn).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByText("Chef Suresh")).toBeInTheDocument();
    });

    // Press Enter key to collapse
    fireEvent.keyDown(toggleBtn, { key: "Enter" });
    await waitFor(() => {
      expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByText("Chef Suresh")).not.toBeInTheDocument();
    });
  });

  // 12. ChefWorkloadPanel component unit test (uncontrolled & empty states)
  it("handles empty chefs state and controlled/uncontrolled toggle gracefully in ChefWorkloadPanel", () => {
    const { unmount } = render(
      <MemoryRouter>
        <ChefWorkloadPanel chefs={[]} loading={false} />
      </MemoryRouter>
    );

    // Header visible with 0 count
    const toggleBtn = screen.getByRole("button", { name: /Chef Stations & Workload/i });
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/No active kitchen chefs found/i)).not.toBeInTheDocument();

    // Click to expand empty state
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/No active kitchen chefs found/i)).toBeInTheDocument();

    unmount();

    // Test with chefs loaded
    render(
      <MemoryRouter>
        <ChefWorkloadPanel chefs={initialChefs} defaultExpanded={false} />
      </MemoryRouter>
    );

    const updatedToggleBtn = screen.getByRole("button", { name: /Chef Stations & Workload/i });
    expect(updatedToggleBtn).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Chef Suresh")).not.toBeInTheDocument();

    fireEvent.click(updatedToggleBtn);
    expect(updatedToggleBtn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Chef Suresh")).toBeInTheDocument();
  });
});
