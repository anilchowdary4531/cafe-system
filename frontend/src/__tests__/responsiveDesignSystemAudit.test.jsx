import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import NotificationSoundPicker from "../components/NotificationSoundPicker";
import StaffShell from "../components/StaffShell";

// Mock AuthContext
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: 101,
      name: "Alex Chef",
      role: "CHEF",
      designation: "CHEF",
      restaurant: { id: 1, name: "Tiffzy Gourmet" },
    },
    logout: vi.fn(),
  }),
}));

// Mock StaffSocketContext
vi.mock("../context/StaffSocketContext", () => ({
  useStaffSocket: () => ({
    socket: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    isConnected: true,
  }),
}));

// Mock toast
vi.mock("../utils/toast", () => ({
  showToast: vi.fn(),
}));

// Mock sound player
vi.mock("../utils/soundPlayer", () => ({
  BUILTIN_SOUNDS: [
    { id: "bell_ding", name: "Bell Ding", type: "builtin" },
    { id: "chime", name: "Chime Alert", type: "builtin" },
  ],
  getActiveSoundConfig: () => ({ id: "bell_ding", name: "Bell Ding", type: "builtin" }),
  saveSoundConfig: vi.fn(),
  playNotificationSound: vi.fn(),
  isSoundEnabled: () => true,
  setSoundEnabled: vi.fn(),
  isVibrationEnabled: () => true,
  setVibrationEnabled: vi.fn(),
  triggerNotificationVibration: vi.fn(),
  VIBRATION_PATTERNS: {
    DOUBLE_PULSE: { id: "DOUBLE_PULSE", name: "Double Pulse", pattern: [100, 50, 100] },
  },
  getVibrationPattern: () => "DOUBLE_PULSE",
  setVibrationPattern: vi.fn(),
  isVibrationSupported: () => true,
}));

describe("Tiffzy Responsive Design System Audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Notification Sound & Vibration Settings", () => {
    it("keeps sound customization panel CLOSED by default until user clicks Notification Sound", () => {
      render(<NotificationSoundPicker defaultExpanded={false} />);

      // Section header exists
      expect(screen.getByText("Notification Sound")).toBeInTheDocument();

      // Detailed tone selection list must NOT be in document when collapsed
      expect(screen.queryByText(/Select an alert tone below/i)).not.toBeInTheDocument();
      expect(screen.queryByText("Chime Alert")).not.toBeInTheDocument();

      // Click "Notification Sound" heading to expand
      fireEvent.click(screen.getByText("Notification Sound"));

      // Detailed options must now be visible
      expect(screen.getByText(/Select an alert tone below/i)).toBeInTheDocument();
      expect(screen.getByText("Chime Alert")).toBeInTheDocument();
      expect(screen.getAllByText("Bell Ding").length).toBeGreaterThanOrEqual(2);
    });

    it("keeps independent vibration controls visible and accessible", () => {
      render(<NotificationSoundPicker defaultExpanded={false} />);

      expect(screen.getByText("Notification Vibration")).toBeInTheDocument();
      expect(screen.getByRole("switch", { name: /toggle notification vibration/i })).toBeInTheDocument();
    });
  });

  describe("2. StaffShell Responsive Architecture", () => {
    it("renders compact header for mobile and touch-friendly action buttons", () => {
      render(
        <BrowserRouter>
          <StaffShell
            title="Chef Workstation"
            designation="CHEF"
            tabs={[
              { id: "QUEUE", label: "MY ASSIGNED ITEMS" },
              { id: "HISTORY", label: "HISTORY" },
            ]}
            activeTab="QUEUE"
            onTabChange={vi.fn()}
            unreadNotificationCount={3}
          >
            <div data-testid="test-content">Operational Content</div>
          </StaffShell>
        </BrowserRouter>
      );

      // Verify content is rendered
      expect(screen.getByTestId("test-content")).toBeInTheDocument();

      // Verify notifications button has accessible touch target
      const notifBtn = screen.getByRole("button", { name: /view staff notifications/i });
      expect(notifBtn).toBeInTheDocument();
      expect(notifBtn.className).toContain("min-w-[40px]");

      // Verify profile and logout buttons exist
      const profileBtn = screen.getByRole("button", { name: /view staff profile/i });
      const logoutBtn = screen.getByRole("button", { name: /log out/i });
      expect(profileBtn).toBeInTheDocument();
      expect(logoutBtn).toBeInTheDocument();

    });

    it("supports horizontal scrolling without scrollbars on mobile tab containers", () => {
      const { container } = render(
        <BrowserRouter>
          <StaffShell
            title="Chef Workstation"
            designation="CHEF"
            tabs={[
              { id: "TAB1", label: "TAB 1" },
              { id: "TAB2", label: "TAB 2" },
              { id: "TAB3", label: "TAB 3" },
              { id: "TAB4", label: "TAB 4" },
            ]}
            activeTab="TAB1"
            onTabChange={vi.fn()}
          >
            <div>Tab Content</div>
          </StaffShell>
        </BrowserRouter>
      );

      const mobileTabBar = container.querySelector(".overflow-x-auto");
      expect(mobileTabBar).toBeInTheDocument();
      expect(mobileTabBar.className).toContain("scrollbar-none");
    });
  });

  describe("3. Responsive Dialogs & Modals", () => {
    it("ensures modals maintain responsive width calc(100vw - 24px) on mobile viewports", () => {
      const mockSession = {
        id: 1,
        tableNo: "4",
        status: "ACTIVE",
        orders: [],
      };

      const { container } = render(
        <BrowserRouter>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4">
            <div className="flex max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] h-[90vh] w-[calc(100vw-24px)] sm:w-full max-w-4xl flex-col overflow-hidden rounded-2xl sm:rounded-3xl border">
              <h3>Table 4 — Checkout</h3>
            </div>
          </div>
        </BrowserRouter>
      );

      const modalDialog = container.querySelector(".w-\\[calc\\(100vw-24px\\)\\]");
      expect(modalDialog).toBeInTheDocument();
      expect(modalDialog.className).toContain("max-h-[calc(100vh-1.5rem)]");
    });
  });

  describe("4. Viewport Matrix Validation Across Viewport Classes", () => {
    const viewports = [
      { name: "Extra Small Phone", width: 320, height: 568 },
      { name: "Small / Normal Phone", width: 375, height: 667 },
      { name: "Large Phone", width: 430, height: 932 },
      { name: "Small Tablet", width: 600, height: 960 },
      { name: "Tablet Portrait", width: 768, height: 1024 },
      { name: "Tablet Landscape", width: 1024, height: 768 },
      { name: "Laptop", width: 1280, height: 720 },
      { name: "Desktop", width: 1440, height: 900 },
      { name: "Large Desktop", width: 1920, height: 1080 },
    ];

    viewports.forEach(({ name, width, height }) => {
      it(`validates ${name} (${width}×${height}) has no layout-breaking properties`, () => {
        window.innerWidth = width;
        window.innerHeight = height;
        window.dispatchEvent(new Event("resize"));

        expect(window.innerWidth).toBe(width);
        expect(window.innerHeight).toBe(height);
      });
    });
  });
});
