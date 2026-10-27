import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import Kitchen from "../pages/Kitchen";
import KitchenChefDetail from "../pages/KitchenChefDetail";

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
const mockSocketOn = vi.fn();
const mockSocketOff = vi.fn();
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

// Mock Toast
vi.mock("../utils/toast", () => ({
  showToast: vi.fn(),
}));

import { api } from "../utils/apiClient";

describe("Senior Chef Command Center & Individual Chef Station Suite", () => {
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
            chefs: [
              { chefId: 21, chefName: "Chef Ravi", designation: "Line Chef", assigned: 3, pending: 1, preparing: 2, ready: 0, capacity: 10 },
              { chefId: 22, chefName: "Chef Suresh", designation: "Line Chef", assigned: 1, pending: 1, preparing: 0, ready: 0, capacity: 10 },
            ],
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
                  {
                    id: 2,
                    name: "Paneer Tikka",
                    itemName: "Paneer Tikka",
                    qty: 1,
                    quantity: 1,
                    status: "PENDING",
                    assignedChefId: 21,
                    assignedChefName: "Chef Ravi",
                    assignmentSource: "DISPATCHED",
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
        return Promise.resolve({
          data: {
            ok: true,
            items: [
              {
                id: 2,
                kotId: 428,
                kotNumber: "KOT-428",
                tableNo: "T4",
                priority: "NORMAL",
                name: "Paneer Tikka",
                quantity: 1,
                status: "PENDING",
                assignedChefId: 21,
                assignedChefName: "Chef Ravi",
                assignmentSource: "DISPATCHED",
              },
            ],
          },
        });
      }
      if (url.includes("/available-work")) {
        return Promise.resolve({
          data: {
            ok: true,
            mode: "SELF_PICK",
            scope: "ITEMS",
            availableItems: [
              {
                id: 1,
                kotId: 428,
                kotNumber: "KOT-428",
                tableNo: "T4",
                priority: "NORMAL",
                name: "Vankaya Baji",
                quantity: 2,
                status: "PENDING",
                elapsedMinutes: 5,
              },
            ],
            availableKots: [],
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    api.put.mockImplementation((url, body) => {
      if (url.includes("/kitchen/config")) {
        return Promise.resolve({
          data: {
            ok: true,
            mode: body?.mode || "DISPATCHER",
            scope: body?.scope || "ITEMS",
          },
        });
      }
      return Promise.resolve({ data: { ok: true } });
    });
    api.post.mockResolvedValue({ data: { ok: true } });
  });

  // 1. Mode Switch: DISPATCHER and SELF-PICK
  it("renders Senior Chef Command Center with DISPATCHER and SELF-PICK mode toggles", async () => {
    render(
      <MemoryRouter initialEntries={["/kitchen"]}>
        <Kitchen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Senior Chef Command Center/i)).toBeInTheDocument();
    });

    // Verify Dashboard button is removed
    expect(screen.queryByRole("link", { name: /^Dashboard$/i })).not.toBeInTheDocument();

    // Mode buttons exist
    const dispatcherBtn = screen.getByRole("button", { name: "DISPATCHER" });
    const selfPickBtn = screen.getByRole("button", { name: "SELF-PICK" });
    expect(dispatcherBtn).toBeInTheDocument();
    expect(selfPickBtn).toBeInTheDocument();

    // Clicking SELF-PICK triggers PUT /kitchen/config
    fireEvent.click(selfPickBtn);
    expect(api.put).toHaveBeenCalledWith(
      expect.stringContaining("/kitchen/config"),
      expect.objectContaining({ mode: "SELF_PICK" })
    );
  });

  // 2. Scope Switch
  it("shows scope controls when SELF-PICK mode is active", async () => {
    render(
      <MemoryRouter initialEntries={["/kitchen"]}>
        <Kitchen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Senior Chef Command Center/i)).toBeInTheDocument();
    });

    // Click SELF-PICK mode button
    const selfPickBtn = screen.getByRole("button", { name: "SELF-PICK" });
    fireEvent.click(selfPickBtn);

    await waitFor(() => {
      expect(screen.getByText("ITEMS")).toBeInTheDocument();
      expect(screen.getByText("KOTS")).toBeInTheDocument();
      expect(screen.getByText("BOTH")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("BOTH"));
    expect(api.put).toHaveBeenCalledWith(
      expect.stringContaining("/kitchen/config"),
      expect.objectContaining({ scope: "BOTH" })
    );
  });

  // 3. Chef Workload Panel & Unassigned Queue Filter
  it("renders Chef Workload Panel collapsed by default and filters KDS to unassigned items when expanded", async () => {
    render(
      <MemoryRouter initialEntries={["/kitchen"]}>
        <Kitchen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Senior Chef Command Center/i)).toBeInTheDocument();
      expect(screen.getByText(/Chef Stations & Workload/i)).toBeInTheDocument();
      // Workload panel should be collapsed by default
      expect(screen.queryByText("Chef Suresh")).not.toBeInTheDocument();
      expect(screen.queryByText(/Unassigned Queue/i)).not.toBeInTheDocument();
    });

    // Expand the Chef Stations & Workload section
    fireEvent.click(screen.getByText(/Chef Stations & Workload/i));

    await waitFor(() => {
      expect(screen.getByText("Chef Suresh")).toBeInTheDocument();
      expect(screen.getByText(/Unassigned Queue/i)).toBeInTheDocument();
    });

    // Clicking Unassigned queue updates filter
    fireEvent.click(screen.getByText(/Unassigned Queue/i));
    await waitFor(() => {
      expect(screen.getByText(/UNASSIGNED ONLY/i)).toBeInTheDocument();
    });
  });

  // 4. Assignment Drawer
  it("opens Assignment Drawer when Senior Chef clicks Assign on KOT card", async () => {
    render(
      <MemoryRouter initialEntries={["/kitchen"]}>
        <Kitchen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("KOT-428")).toBeInTheDocument();
    });

    // Click assign button on card header
    const assignButtons = screen.getAllByRole("button", { name: /Assign/i });
    fireEvent.click(assignButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Assign KOT #KOT-428/i)).toBeInTheDocument();
      expect(screen.getByText(/Select Target Chef:/i)).toBeInTheDocument();
    });
  });

  // 5. Individual Chef Station: Access Control
  it("enforces Access Denied when line chef accesses another chef's station URL", async () => {
    mockCurrentUser = {
      id: 21,
      name: "Chef Ravi",
      role: "CHEF",
      designation: "Line Chef",
      restaurantId: 1,
    };

    render(
      <MemoryRouter initialEntries={["/kitchen/chef/22"]}>
        <Routes>
          <Route path="/kitchen/chef/:chefId" element={<KitchenChefDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Access Denied/i)).toBeInTheDocument();
      expect(screen.getByText(/You can only access your own assigned chef station/i)).toBeInTheDocument();
    });
  });

  // 6. Individual Chef Station: My Assigned Items & Lifecycle Actions
  it("renders Chef Ravi's assigned items and allows starting preparation", async () => {
    mockCurrentUser = {
      id: 21,
      name: "Chef Ravi",
      role: "CHEF",
      designation: "Line Chef",
      restaurantId: 1,
    };

    render(
      <MemoryRouter initialEntries={["/kitchen/chef/21"]}>
        <Routes>
          <Route path="/kitchen/chef/:chefId" element={<KitchenChefDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Paneer Tikka/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /START PREPARING/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /START PREPARING/i }));
    expect(api.put).toHaveBeenCalledWith(
      expect.stringContaining("/kitchen/items/2/status"),
      expect.objectContaining({ status: "PREPARING" })
    );
  });

  // 7. Chef Station Self-Pick Queue & Claim
  it("allows Chef to claim available unassigned work in SELF_PICK mode", async () => {
    mockCurrentUser = {
      id: 21,
      name: "Chef Ravi",
      role: "CHEF",
      designation: "Line Chef",
      restaurantId: 1,
    };

    api.get.mockImplementation((url) => {
      if (url.includes("/kitchen/config")) {
        return Promise.resolve({
          data: { ok: true, mode: "SELF_PICK", scope: "ITEMS" },
        });
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
            availableItems: [
              {
                id: 1,
                kotId: 428,
                kotNumber: "KOT-428",
                tableNo: "T4",
                name: "Vankaya Baji",
                quantity: 2,
                status: "PENDING",
                elapsedMinutes: 3,
              },
            ],
            availableKots: [],
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    render(
      <MemoryRouter initialEntries={["/kitchen/chef/21"]}>
        <Routes>
          <Route path="/kitchen/chef/:chefId" element={<KitchenChefDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Vankaya Baji/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /CLAIM ITEM/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /CLAIM ITEM/i }));
    expect(api.post).toHaveBeenCalledWith(
      expect.stringContaining("/kitchen/items/1/self-pick")
    );
  });

  // 8. Designation-aware role routing
  it("determines correct routing path based on Senior Chef vs Line Chef designation", async () => {
    const { isSeniorChef, getChefStationPath } = await import("../utils/staffRole");
    const { getRedirectPath } = await import("../pages/Login");

    expect(isSeniorChef("CHEF", "Senior Chef")).toBe(true);
    expect(isSeniorChef("CHEF", "Head Chef")).toBe(true);
    expect(isSeniorChef("CHEF", "Executive Chef")).toBe(true);
    expect(isSeniorChef("CHEF", "Line Chef")).toBe(false);
    expect(isSeniorChef("CHEF", "Chef")).toBe(false);

    expect(getChefStationPath({ id: 10, role: "CHEF", designation: "Senior Chef" })).toBe("/kitchen");
    expect(getChefStationPath({ id: 21, role: "CHEF", designation: "Line Chef" })).toBe("/kitchen/chef/21");

    expect(getRedirectPath("CHEF", "Senior Chef", 10)).toBe("/kitchen");
    expect(getRedirectPath("CHEF", "Line Chef", 21)).toBe("/kitchen/chef/21");
  });

  // 9. Senior Chef sees Top KPI Summary Area with backend authoritative metrics
  it("displays 8 operational KPI summary cards on Senior Chef Dashboard", async () => {
    render(
      <MemoryRouter initialEntries={["/kitchen"]}>
        <Kitchen />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("New Orders")).toBeInTheDocument();
      expect(screen.getByText("Unassigned")).toBeInTheDocument();
      expect(screen.getByText("Preparing")).toBeInTheDocument();
      expect(screen.getByText("Ready")).toBeInTheDocument();
      expect(screen.getByText("Overdue")).toBeInTheDocument();
      expect(screen.getByText("Active Chefs")).toBeInTheDocument();
      expect(screen.getByText("Capacity")).toBeInTheDocument();
      expect(screen.getByText("SLA Delays")).toBeInTheDocument();
      expect(screen.getByText(/Unassigned Work Queue/i)).toBeInTheDocument();
    });
  });

  // 10. Chef Station does NOT show global unassigned queue or other chefs' workload
  it("isolates Chef Station to personal queue and hides other chefs' workload", async () => {
    mockCurrentUser = {
      id: 21,
      name: "Chef Ravi",
      role: "CHEF",
      designation: "Line Chef",
      restaurantId: 1,
    };

    render(
      <MemoryRouter initialEntries={["/kitchen/chef/21"]}>
        <Routes>
          <Route path="/kitchen/chef/:chefId" element={<KitchenChefDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/CHEF STATION/i)).toBeInTheDocument();
      expect(screen.getByText(/My Preparation Queue/i)).toBeInTheDocument();
      // Does NOT show other chef
      expect(screen.queryByText("Chef Suresh")).not.toBeInTheDocument();
      // Does NOT show managerial controls
      expect(screen.queryByText(/Unassigned Work Queue/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/DISPATCHER/i)).not.toBeInTheDocument();
    });
  });
});

