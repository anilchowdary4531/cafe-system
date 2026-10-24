import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import KitchenChefDetail from "../pages/KitchenChefDetail";
import { api } from "../utils/apiClient";

vi.mock("../utils/apiClient", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 14, name: "Chef R14", role: "CHEF", designation: "Line Chef", restaurantId: 1 },
    token: "valid-token",
  }),
}));

vi.mock("../context/StaffSocketContext", () => ({
  useStaffSocket: () => ({
    socket: {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    },
    isConnected: true,
  }),
}));

describe("Chef Station UI Cleanup — Compact Workstation & Layout Validation", () => {
  const mockAssignedItems = [
    {
      id: 101,
      name: "Paneer Butter Masala",
      quantity: 2,
      status: "PENDING",
      kotId: 501,
      kotNumber: "KOT-501",
      tableNo: "T4",
      priority: "NORMAL",
      elapsedMinutes: 5,
      assignmentSource: "DISPATCHED",
      variant: null,
      notes: "Less spicy",
    },
    {
      id: 102,
      name: "Garlic Naan",
      quantity: 3,
      status: "PREPARING",
      kotId: 502,
      kotNumber: "KOT-502",
      tableNo: "T2",
      priority: "URGENT",
      elapsedMinutes: 8,
      assignmentSource: "SELF_PICKED",
      variant: "Butter",
      notes: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation((url) => {
      if (url.includes("/kitchen/config")) {
        return Promise.resolve({ data: { success: true, config: { mode: "DISPATCHER", scope: "ITEMS" } } });
      }
      if (url.includes("/kitchen/chef/14/assigned-items")) {
        return Promise.resolve({
          data: {
            ok: true,
            chef: { id: 14, name: "Cafe King Chef R14", designation: "Line Chef" },
            items: mockAssignedItems,
          },
        });
      }
      if (url.includes("/kitchen/chef/14/history")) {
        return Promise.resolve({
          data: {
            success: true,
            items: [],
            pagination: { page: 1, limit: 20, totalCount: 0, totalPages: 1, hasMore: false },
          },
        });
      }
      return Promise.resolve({ data: { success: true } });
    });
  });

  const renderComponent = (initialPath = "/kitchen/chef/14") => {
    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/kitchen/chef/:chefId" element={<KitchenChefDetail />} />
          <Route path="/kitchen/chef/:chefId/history" element={<KitchenChefDetail />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it("1. Renders compact workstation header without excessive padding", async () => {
    const { container } = renderComponent();

    await waitFor(() => {
      expect(screen.getByText("CHEF STATION")).toBeInTheDocument();
    });

    const header = container.querySelector("header");
    expect(header).toBeInTheDocument();
    expect(header.className).toContain("py-2");
    expect(header.className).toContain("sm:py-2.5");
  });

  it("2. Main container eliminates large vertical padding and oversized section gaps", async () => {
    const { container } = renderComponent();

    await waitFor(() => {
      expect(screen.getByText("MY ASSIGNED ITEMS")).toBeInTheDocument();
    });

    const main = container.querySelector("main");
    expect(main).toBeInTheDocument();
    // Compact vertical padding instead of old p-6 (24px)
    expect(main.className).toContain("py-2.5");
    expect(main.className).toContain("sm:py-3.5");
    // Tight spacing hierarchy instead of old space-y-6
    expect(main.className).toContain("space-y-3");
    expect(main.className).toContain("sm:space-y-3.5");
  });

  it("3. Metric badges use a compact workstation toolbar layout", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("My Assigned Total")).toBeInTheDocument();
    });

    const assignedTotalLabel = screen.getByText("My Assigned Total");
    const metricCard = assignedTotalLabel.parentElement;
    expect(metricCard.className).toContain("py-1.5");
    expect(metricCard.className).toContain("sm:py-2");
    expect(metricCard.className).toContain("rounded-lg");
  });

  it("4. Filter tabs are streamlined without bulky outer dividing card boxes", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/All \(2\)/)).toBeInTheDocument();
    });

    const allFilterBtn = screen.getByText(/All \(2\)/);
    const filterContainer = allFilterBtn.parentElement;
    // Outer card box border/shadow removed, replaced with sleek embedded container
    expect(filterContainer.className).toContain("p-0.5");
    expect(filterContainer.className).not.toContain("border-slate-200 dark:border-slate-700 p-1");
  });

  it("5. Item cards maintain all functional information in a dense, compact structure", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Paneer Butter Masala")).toBeInTheDocument();
      expect(screen.getByText("Garlic Naan")).toBeInTheDocument();
    });

    // Verify critical elements are present
    expect(screen.getByText("#KOT-501")).toBeInTheDocument();
    expect(screen.getByText("Table: T4")).toBeInTheDocument();
    expect(screen.getByText("2x")).toBeInTheDocument();
    expect(screen.getByText("Waiting: 5m")).toBeInTheDocument();
    expect(screen.getByText("Dispatched")).toBeInTheDocument();

    // Urgent badge and self-picked
    expect(screen.getByText("URGENT")).toBeInTheDocument();
    expect(screen.getByText("Self-Picked")).toBeInTheDocument();

    // Action button prominent and intact
    expect(screen.getByText("START PREPARING")).toBeInTheDocument();
    expect(screen.getByText("MARK READY")).toBeInTheDocument();

    // Verify card padding is tight (p-3 sm:p-3.5 instead of old p-4)
    const card = screen.getByText("Paneer Butter Masala").closest(".bg-white");
    expect(card.className).toContain("p-3");
    expect(card.className).toContain("sm:p-3.5");
  });

  it("6. Responsive grid scales efficiently from mobile (single column) to tablet (2 cols) and desktop (3-5 cols)", async () => {
    const { container } = renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Paneer Butter Masala")).toBeInTheDocument();
    });

    const grid = container.querySelector(".grid.grid-cols-1");
    expect(grid).toBeInTheDocument();
    expect(grid.className).toContain("sm:grid-cols-2");
    expect(grid.className).toContain("lg:grid-cols-3");
    expect(grid.className).toContain("xl:grid-cols-4");
    expect(grid.className).toContain("2xl:grid-cols-5");
    expect(grid.className).toContain("gap-2.5");
  });
});
