import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import Kitchen from "../pages/Kitchen";
import ChefAssignmentActions from "../components/ChefAssignmentActions";
import ReassignChefModal from "../components/ReassignChefModal";
import AssignmentDetailsModal from "../components/AssignmentDetailsModal";
import UnassignConfirmModal from "../components/UnassignConfirmModal";

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
  name: "Senior Chef Vikram",
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

describe("Assigned Chef Actions & Three-Dot Overflow Menu Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser = {
      id: 10,
      name: "Senior Chef Vikram",
      role: "CHEF",
      designation: "Senior Chef",
      restaurantId: 1,
    };
  });

  const setupMockResponses = (kotsList = null) => {
    const defaultKots = [
      {
        id: 219,
        kotNo: "KOT-219",
        orderId: 501,
        stationName: "COFFEE BAR",
        tableNo: "T4",
        status: "PENDING",
        priority: "NORMAL",
        createdAt: new Date().toISOString(),
        estimatedPrepTimeMinutes: 15,
        items: [
          {
            id: 101,
            orderItemId: 101,
            itemName: "Ice Latte",
            qty: 1,
            status: "PENDING",
            assignedChefId: 14,
            assignedChefName: "Cafe King Chef R14",
            assignmentSource: "DISPATCHED",
            assignedAt: new Date().toISOString(),
          },
        ],
      },
      {
        id: 220,
        kotNo: "KOT-220",
        orderId: 502,
        stationName: "HOT KITCHEN",
        tableNo: "T7",
        status: "PENDING",
        priority: "HIGH",
        createdAt: new Date().toISOString(),
        estimatedPrepTimeMinutes: 20,
        items: [
          {
            id: 201,
            orderItemId: 201,
            itemName: "Butter Chicken",
            qty: 1,
            status: "PENDING",
            assignedChefId: 14,
            assignedChefName: "Cafe King Chef R14",
            assignmentSource: "DISPATCHED",
          },
          {
            id: 202,
            orderItemId: 202,
            itemName: "Garlic Naan",
            qty: 2,
            status: "PENDING",
            assignedChefId: 15,
            assignedChefName: "Chef Arjun R15",
            assignmentSource: "DISPATCHED",
          },
          {
            id: 203,
            orderItemId: 203,
            itemName: "Mango Lassi",
            qty: 1,
            status: "PENDING",
            assignedChefId: null,
            assignedChefName: null,
            assignmentSource: null,
          },
        ],
      },
    ];

    api.get.mockImplementation((url) => {
      if (url.includes("/stations")) {
        return Promise.resolve({ data: { ok: true, stations: [{ id: 1, name: "COFFEE BAR" }, { id: 2, name: "HOT KITCHEN" }] } });
      }
      if (url.includes("/kots")) {
        return Promise.resolve({ data: { ok: true, kots: kotsList || defaultKots } });
      }
      if (url.includes("/config")) {
        return Promise.resolve({ data: { ok: true, mode: "DISPATCHER", scope: "ALL_ACTIVE" } });
      }
      if (url.includes("/workload")) {
        return Promise.resolve({
          data: {
            ok: true,
            chefs: [
              {
                id: 14,
                chefId: 14,
                name: "Cafe King Chef R14",
                active: true,
                capacity: 10,
                assigned: 2,
                pending: 2,
                preparing: 0,
                ready: 0,
                utilization: 20,
              },
              {
                id: 15,
                chefId: 15,
                name: "Chef Arjun R15",
                active: true,
                capacity: 8,
                assigned: 1,
                pending: 1,
                preparing: 0,
                ready: 0,
                utilization: 12,
              },
              {
                id: 16,
                chefId: 16,
                name: "Chef Maya R16",
                active: true,
                capacity: 10,
                assigned: 0,
                pending: 0,
                preparing: 0,
                ready: 0,
                utilization: 0,
              },
            ],
          },
        });
      }
      if (url.includes("/unread-count")) {
        return Promise.resolve({ data: { success: true, count: 0 } });
      }
      return Promise.resolve({ data: { ok: true } });
    });
  };

  /* ==========================================================
     TEST 1: UNASSIGNED ITEM SHOWS ASSIGN, ASSIGNED ITEM DOES NOT
     ========================================================== */
  it("displays [Assign] for unassigned item and [ ⋮ ] (NOT Assign) for already assigned item", async () => {
    setupMockResponses();

    render(
      <MemoryRouter initialEntries={["/kitchen"]}>
        <Routes>
          <Route path="/kitchen" element={<Kitchen />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for KOT-219 to render
    await waitFor(() => {
      expect(screen.getByText("KOT-219")).toBeInTheDocument();
    });

    const kot219Card = screen.getByText("KOT-219").closest("article");
    const kot220Card = screen.getByText("KOT-220").closest("article");

    // In KOT-219: 1/1 Assigned -> Ice Latte is assigned to Chef R14
    expect(within(kot219Card).getByText("1/1 Assigned")).toBeInTheDocument();
    expect(within(kot219Card).getByText("Ice Latte")).toBeInTheDocument();
    const badge101 = screen.getByTestId("chef-badge-101");
    expect(badge101).toBeInTheDocument();
    expect(within(badge101).getByText("Cafe King Chef R14")).toBeInTheDocument();

    // MUST NOT display [Assign] for assigned item 101
    expect(screen.queryByTestId("assign-item-btn-101")).not.toBeInTheDocument();

    // MUST display [ ⋮ ] three-dot menu button for item 101
    const threeDotBtn = screen.getByTestId("three-dot-menu-btn-101");
    expect(threeDotBtn).toBeInTheDocument();
    expect(threeDotBtn).toHaveAttribute("data-order-item-id", "101");

    // In KOT-220: Mixed KOT (2/3 Assigned)
    expect(within(kot220Card).getByText("2/3 Assigned")).toBeInTheDocument();
    expect(within(kot220Card).getByText("Butter Chicken")).toBeInTheDocument();
    expect(screen.getByTestId("chef-badge-201")).toBeInTheDocument();
    expect(screen.getByTestId("three-dot-menu-btn-201")).toBeInTheDocument();

    expect(within(kot220Card).getByText("Garlic Naan")).toBeInTheDocument();
    expect(screen.getByTestId("chef-badge-202")).toBeInTheDocument();
    expect(screen.getByTestId("three-dot-menu-btn-202")).toBeInTheDocument();

    // Item 203 (Mango Lassi) is UNASSIGNED in KOT-220
    expect(within(kot220Card).getByText("Mango Lassi")).toBeInTheDocument();
    expect(screen.getByTestId("unassigned-badge-203")).toBeInTheDocument();
    expect(screen.getByTestId("assign-item-btn-203")).toBeInTheDocument();
  });

  /* ==========================================================
     TEST 2: KOT HEADER ASSIGN BUTTON IS HIDDEN WHEN ALL ASSIGNED
     ========================================================== */
  it("hides the KOT header [Assign] button when all items are assigned (fixes KOT-219 header bug)", async () => {
    setupMockResponses();

    render(
      <MemoryRouter initialEntries={["/kitchen"]}>
        <Routes>
          <Route path="/kitchen" element={<Kitchen />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("KOT-219")).toBeInTheDocument();
    });

    // KOT-219 is 1/1 assigned -> header button MUST NOT exist
    expect(screen.queryByTestId("kot-header-assign-btn-219")).not.toBeInTheDocument();

    // Inside kot219 article, there should be NO Assign button at all!
    const kot219Card = screen.getByText("KOT-219").closest("article");
    const assignButtonsInKot219 = within(kot219Card).queryAllByRole("button", { name: /assign/i });
    expect(assignButtonsInKot219.length).toBe(0);

    // In contrast, KOT-220 (2/3 Assigned) has an unassigned item, so header shows Assign
    expect(screen.getByTestId("kot-header-assign-btn-220")).toBeInTheDocument();
  });

  /* ==========================================================
     TEST 3: THREE-DOT OVERFLOW MENU INTERACTION & ACTIONS
     ========================================================== */
  it("opens three-dot overflow menu on click with Reassign, View Details, and Unassign options", async () => {
    setupMockResponses();

    render(
      <MemoryRouter initialEntries={["/kitchen"]}>
        <Routes>
          <Route path="/kitchen" element={<Kitchen />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("three-dot-menu-btn-101")).toBeInTheDocument();
    });

    const menuBtn = screen.getByTestId("three-dot-menu-btn-101");

    // Initially dropdown menu is not visible
    expect(screen.queryByTestId("three-dot-menu-101")).not.toBeInTheDocument();

    // Click three-dot button
    fireEvent.click(menuBtn);

    // Menu should now be open
    expect(screen.getByTestId("three-dot-menu-101")).toBeInTheDocument();
    expect(screen.getByTestId("menu-action-reassign-101")).toHaveTextContent("Reassign to another Chef");
    expect(screen.getByTestId("menu-action-details-101")).toHaveTextContent("View Assignment Details");
    expect(screen.getByTestId("menu-action-unassign-101")).toHaveTextContent("Unassign Chef");

    // Clicking button again toggles it closed
    fireEvent.click(menuBtn);
    expect(screen.queryByTestId("three-dot-menu-101")).not.toBeInTheDocument();
  });

  /* ==========================================================
     TEST 4: REASSIGN TO ANOTHER CHEF MODAL & EXECUTION
     ========================================================== */
  it("opens Reassign Chef modal, shows workload/capacities, and submits reassignment to new chef", async () => {
    setupMockResponses();

    api.post.mockResolvedValueOnce({
      data: {
        ok: true,
        message: "Item reassigned successfully",
        item: {
          id: 101,
          orderItemId: 101,
          assignedChefId: 15,
          assignedChefName: "Chef Arjun R15",
          assignmentSource: "DISPATCHED",
        },
      },
    });

    render(
      <MemoryRouter initialEntries={["/kitchen"]}>
        <Routes>
          <Route path="/kitchen" element={<Kitchen />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("three-dot-menu-btn-101")).toBeInTheDocument();
    });

    // Open three-dot menu
    fireEvent.click(screen.getByTestId("three-dot-menu-btn-101"));

    // Click "Reassign to another Chef"
    fireEvent.click(screen.getByTestId("menu-action-reassign-101"));

    // Verify modal appears
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(within(screen.getByRole("dialog")).getByText("Reassign to another Chef")).toBeInTheDocument();
    });

    const modal = screen.getByRole("dialog");
    expect(within(modal).getByText("1× Ice Latte")).toBeInTheDocument();
    expect(within(modal).getByText("Current: Cafe King Chef R14")).toBeInTheDocument();

    // Select Chef Arjun R15
    const chef15Radio = within(modal).getByTestId("chef-option-15");
    expect(chef15Radio).toBeInTheDocument();
    fireEvent.click(chef15Radio);

    // Click "Confirm Reassignment" button
    const confirmBtn = within(modal).getByTestId("confirm-reassign-btn");
    fireEvent.click(confirmBtn);

    // Authoritative reassignment API was called with canonical itemId and new chefId
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/owner/1/kitchen/items/101/reassign", {
        newChefId: 15,
      });
    });
  });

  /* ==========================================================
     TEST 5: VIEW ASSIGNMENT DETAILS MODAL
     ========================================================== */
  it("displays authoritative metadata in View Assignment Details modal", async () => {
    setupMockResponses();

    render(
      <MemoryRouter initialEntries={["/kitchen"]}>
        <Routes>
          <Route path="/kitchen" element={<Kitchen />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("three-dot-menu-btn-101")).toBeInTheDocument();
    });

    // Open three-dot menu
    fireEvent.click(screen.getByTestId("three-dot-menu-btn-101"));

    // Click "View Assignment Details"
    fireEvent.click(screen.getByTestId("menu-action-details-101"));

    // Modal should be open
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(within(screen.getByRole("dialog")).getByText("View Assignment Details")).toBeInTheDocument();
    });

    const modal = screen.getByRole("dialog");
    expect(within(modal).getByText("#101")).toBeInTheDocument(); // OrderItem ID
    expect(within(modal).getByText("KOT-219")).toBeInTheDocument(); // KOT Number
    expect(within(modal).getByText("1× Ice Latte")).toBeInTheDocument(); // Item Name
    expect(within(modal).getByText("Cafe King Chef R14")).toBeInTheDocument(); // Current Chef
    expect(within(modal).getByText("COFFEE BAR")).toBeInTheDocument(); // Station
    expect(within(modal).getByText("Table T4")).toBeInTheDocument(); // Table context
  });

  /* ==========================================================
     TEST 6: UNASSIGN CHEF CONFIRMATION & RETURN TO QUEUE
     ========================================================== */
  it("confirms unassigning a chef and updates item to unassigned state via authoritative API", async () => {
    setupMockResponses();

    api.post.mockResolvedValueOnce({
      data: {
        ok: true,
        message: "Chef unassigned successfully",
        item: {
          id: 101,
          orderItemId: 101,
          assignedChefId: null,
          assignedChefName: null,
          assignmentSource: null,
        },
      },
    });

    render(
      <MemoryRouter initialEntries={["/kitchen"]}>
        <Routes>
          <Route path="/kitchen" element={<Kitchen />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("three-dot-menu-btn-101")).toBeInTheDocument();
    });

    // Open three-dot menu
    fireEvent.click(screen.getByTestId("three-dot-menu-btn-101"));

    // Click "Unassign Chef"
    fireEvent.click(screen.getByTestId("menu-action-unassign-101"));

    // Confirmation modal should be visible
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(within(screen.getByRole("dialog")).getByText("Confirm returning item to unassigned work queue")).toBeInTheDocument();
    });

    const modal = screen.getByRole("dialog");
    expect(within(modal).getByText("1× Ice Latte")).toBeInTheDocument();
    expect(within(modal).getAllByText("Cafe King Chef R14").length).toBeGreaterThan(0);

    // Click "Confirm Unassign"
    fireEvent.click(within(modal).getByTestId("confirm-unassign-btn"));

    // Verify authoritative unassign endpoint was called
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/owner/1/kitchen/items/101/unassign");
    });
  });

  /* ==========================================================
     TEST 7: STANDALONE CHEFASSIGNMENTACTIONS COMPONENT UNIT TEST
     ========================================================== */
  it("unit test: ChefAssignmentActions renders correctly for both assigned and unassigned states", () => {
    const onAssign = vi.fn();
    const onReassign = vi.fn();
    const onDetails = vi.fn();
    const onUnassign = vi.fn();

    const unassignedItem = {
      id: 301,
      orderItemId: 301,
      itemName: "Cold Brew",
      qty: 1,
      assignedChefId: null,
    };

    const { rerender } = render(
      <ChefAssignmentActions
        item={unassignedItem}
        kot={{ id: 99, kotNo: "KOT-99" }}
        onOpenAssignDrawer={onAssign}
        onOpenReassignModal={onReassign}
        onOpenDetailsModal={onDetails}
        onOpenUnassignModal={onUnassign}
      />
    );

    // Unassigned state: shows UNASSIGNED badge and [Assign] button
    expect(screen.getByTestId("unassigned-badge-301")).toBeInTheDocument();
    const assignBtn = screen.getByTestId("assign-item-btn-301");
    expect(assignBtn).toBeInTheDocument();
    expect(screen.queryByTestId("three-dot-menu-btn-301")).not.toBeInTheDocument();

    fireEvent.click(assignBtn);
    expect(onAssign).toHaveBeenCalledWith({ id: 99, kotNo: "KOT-99" }, 301);

    // Switch to assigned state
    const assignedItem = {
      ...unassignedItem,
      assignedChefId: 18,
      assignedChefName: "Chef Rahul",
      assignmentSource: "SELF_PICKED",
    };

    rerender(
      <ChefAssignmentActions
        item={assignedItem}
        kot={{ id: 99, kotNo: "KOT-99" }}
        onOpenAssignDrawer={onAssign}
        onOpenReassignModal={onReassign}
        onOpenDetailsModal={onDetails}
        onOpenUnassignModal={onUnassign}
      />
    );

    // Assigned state: NO [Assign] button! Shows chef badge and [ ⋮ ]
    expect(screen.queryByTestId("assign-item-btn-301")).not.toBeInTheDocument();
    expect(screen.getByTestId("chef-badge-301")).toBeInTheDocument();
    expect(screen.getByText("Chef Rahul")).toBeInTheDocument();
    expect(screen.getByText("(SELF)")).toBeInTheDocument();

    const threeDot = screen.getByTestId("three-dot-menu-btn-301");
    expect(threeDot).toBeInTheDocument();

    // Open menu and test actions
    fireEvent.click(threeDot);
    fireEvent.click(screen.getByTestId("menu-action-reassign-301"));
    expect(onReassign).toHaveBeenCalledWith(assignedItem, { id: 99, kotNo: "KOT-99" });

    fireEvent.click(threeDot);
    fireEvent.click(screen.getByTestId("menu-action-details-301"));
    expect(onDetails).toHaveBeenCalledWith(assignedItem, { id: 99, kotNo: "KOT-99" });

    fireEvent.click(threeDot);
    fireEvent.click(screen.getByTestId("menu-action-unassign-301"));
    expect(onUnassign).toHaveBeenCalledWith(assignedItem, { id: 99, kotNo: "KOT-99" });
  });

  /* ==========================================================
     TEST 8: REALTIME SOCKET ITEM_UNASSIGNED EVENT LISTENER
     ========================================================== */
  it("registers socket listener for kitchen:item_unassigned", () => {
    setupMockResponses();

    render(
      <MemoryRouter initialEntries={["/kitchen"]}>
        <Routes>
          <Route path="/kitchen" element={<Kitchen />} />
        </Routes>
      </MemoryRouter>
    );

    expect(mockSocketOn).toHaveBeenCalledWith("kitchen:item_assigned", expect.any(Function));
    expect(mockSocketOn).toHaveBeenCalledWith("kitchen:item_reassigned", expect.any(Function));
    expect(mockSocketOn).toHaveBeenCalledWith("kitchen:item_unassigned", expect.any(Function));
  });
});
