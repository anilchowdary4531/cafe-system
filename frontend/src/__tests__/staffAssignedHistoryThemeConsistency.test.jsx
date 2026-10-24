import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import StaffWorkHistoryTabs, { StaffAssignedHistoryTabs } from "../components/StaffWorkHistoryTabs";
import { getDesignationTheme, STAFF_THEMES } from "../utils/staffThemes";
import { Zap, History, UtensilsCrossed, Shield, Sparkles, Receipt } from "lucide-react";

describe("Staff Work & History Tabs Theme Consistency Suite", () => {
  // 1. Alias export verification
  it("exports StaffAssignedHistoryTabs as canonical alias of StaffWorkHistoryTabs", () => {
    expect(StaffAssignedHistoryTabs).toBe(StaffWorkHistoryTabs);
  });

  // 2. Chef Station theme tests
  describe("Chef Workspace Theme", () => {
    it("renders Chef assigned items and history tabs with Chef theme", () => {
      const handleTabChange = vi.fn();
      render(
        <StaffWorkHistoryTabs
          designation="CHEF"
          activeTab="QUEUE"
          onTabChange={handleTabChange}
          assignedCount={5}
          historyCount={12}
        />
      );

      const assignedTab = screen.getByTestId("tab-assigned-items");
      const historyTab = screen.getByTestId("tab-chef-history");

      expect(assignedTab).toBeInTheDocument();
      expect(historyTab).toBeInTheDocument();
      expect(screen.getByText("MY ASSIGNED ITEMS")).toBeInTheDocument();
      expect(screen.getByText("HISTORY")).toBeInTheDocument();
      expect(screen.getByText("5")).toBeInTheDocument();
      expect(screen.getByText("12")).toBeInTheDocument();

      // Active tab uses Chef orange theme
      expect(assignedTab.className).toContain("bg-orange-600");
      expect(assignedTab.className).toContain("text-white");
      expect(assignedTab).toHaveAttribute("aria-selected", "true");

      // Inactive tab uses neutral background
      expect(historyTab.className).toContain("text-slate-600");
      expect(historyTab).toHaveAttribute("aria-selected", "false");

      // Clicking history calls onTabChange with 'HISTORY'
      fireEvent.click(historyTab);
      expect(handleTabChange).toHaveBeenCalledWith("HISTORY");
    });

    it("applies Chef theme when HISTORY tab is selected", () => {
      render(
        <StaffWorkHistoryTabs
          designation="CHEF"
          activeTab="HISTORY"
          onTabChange={vi.fn()}
          assignedCount={3}
          historyCount={8}
        />
      );

      const assignedTab = screen.getByTestId("tab-assigned-items");
      const historyTab = screen.getByTestId("tab-chef-history");

      expect(historyTab.className).toContain("bg-orange-600");
      expect(historyTab.className).toContain("text-white");
      expect(historyTab).toHaveAttribute("aria-selected", "true");

      expect(assignedTab.className).toContain("text-slate-600");
      expect(assignedTab).toHaveAttribute("aria-selected", "false");
    });
  });

  // 3. Senior Chef Workspace Theme
  describe("Senior Chef Workspace Theme", () => {
    it("renders Senior Chef Command Center tabs with amber theme", () => {
      const handleTabChange = vi.fn();
      render(
        <StaffWorkHistoryTabs
          designation="SENIOR_CHEF"
          activeTab="KDS"
          onTabChange={handleTabChange}
          tabs={[
            { id: "KDS", label: "COMMAND CENTER", icon: Zap, badge: 14, testId: "tab-command-center" },
            { id: "HISTORY", label: "HISTORY", icon: History, badge: 42, testId: "tab-kitchen-history" },
          ]}
        />
      );

      const ccTab = screen.getByTestId("tab-command-center");
      const histTab = screen.getByTestId("tab-kitchen-history");

      expect(ccTab).toBeInTheDocument();
      expect(histTab).toBeInTheDocument();
      expect(screen.getByText("COMMAND CENTER")).toBeInTheDocument();
      expect(screen.getByText("14")).toBeInTheDocument();
      expect(screen.getByText("42")).toBeInTheDocument();

      // Active tab uses Senior Chef amber theme
      expect(ccTab.className).toContain("bg-amber-600");
      expect(ccTab).toHaveAttribute("aria-selected", "true");

      fireEvent.click(histTab);
      expect(handleTabChange).toHaveBeenCalledWith("HISTORY");
    });
  });

  // 4. Server Workspace Theme
  describe("Server / Waiter Workspace Theme", () => {
    it("resolves Server theme with warm orange accent", () => {
      const theme = getDesignationTheme("SERVER");
      expect(theme.id).toBe("SERVER");
      expect(theme.activeTab).toContain("bg-orange-500");

      render(
        <StaffWorkHistoryTabs
          designation="SERVER"
          activeTab="QUEUE"
          assignedCount={7}
          historyCount={19}
        />
      );

      const assignedTab = screen.getByTestId("tab-assigned-items");
      expect(assignedTab.className).toContain("bg-orange-500");
    });

    it("resolves WAITER alias to Server theme", () => {
      const theme = getDesignationTheme("WAITER");
      expect(theme.id).toBe("SERVER");
    });
  });

  // 5. Steward Workspace Theme
  describe("Steward Workspace Theme", () => {
    it("resolves Steward theme with amber food-runner accent", () => {
      const theme = getDesignationTheme("STEWARD");
      expect(theme.id).toBe("STEWARD");
      expect(theme.activeTab).toContain("bg-amber-600");

      render(
        <StaffWorkHistoryTabs
          designation="STEWARD"
          activeTab="QUEUE"
          assignedCount={4}
          historyCount={11}
        />
      );

      const assignedTab = screen.getByTestId("tab-assigned-items");
      expect(assignedTab.className).toContain("bg-amber-600");
    });
  });

  // 6. Cashier Workspace Theme
  describe("Cashier Workspace Theme", () => {
    it("resolves Cashier theme with emerald POS accent", () => {
      const theme = getDesignationTheme("CASHIER");
      expect(theme.id).toBe("CASHIER");
      expect(theme.activeTab).toContain("bg-emerald-600");

      render(
        <StaffWorkHistoryTabs
          designation="CASHIER"
          activeTab="QUEUE"
          assignedCount={9}
          historyCount={50}
        />
      );

      const assignedTab = screen.getByTestId("tab-assigned-items");
      expect(assignedTab.className).toContain("bg-emerald-600");
    });
  });

  // 7. Cleaner Workspace Theme
  describe("Cleaner Workspace Theme", () => {
    it("resolves Cleaner theme with cyan sanitation accent", () => {
      const theme = getDesignationTheme("CLEANER");
      expect(theme.id).toBe("CLEANER");
      expect(theme.activeTab).toContain("bg-cyan-600");

      render(
        <StaffWorkHistoryTabs
          designation="CLEANER"
          activeTab="QUEUE"
          assignedCount={3}
          historyCount={15}
        />
      );

      const assignedTab = screen.getByTestId("tab-assigned-items");
      expect(assignedTab.className).toContain("bg-cyan-600");
    });
  });

  // 8. Swiper Workspace Theme
  describe("Swiper Workspace Theme", () => {
    it("resolves Swiper theme with indigo payment runner accent", () => {
      const theme = getDesignationTheme("SWIPER");
      expect(theme.id).toBe("SWIPER");
      expect(theme.activeTab).toContain("bg-indigo-600");

      render(
        <StaffWorkHistoryTabs
          designation="SWIPER"
          activeTab="QUEUE"
          assignedCount={2}
          historyCount={8}
        />
      );

      const assignedTab = screen.getByTestId("tab-assigned-items");
      expect(assignedTab.className).toContain("bg-indigo-600");
    });
  });

  // 9. Manager / Owner Workspace Theme
  describe("Manager / Owner Workspace Theme", () => {
    it("resolves Manager and Owner to luxury amber theme", () => {
      const managerTheme = getDesignationTheme("MANAGER");
      const ownerTheme = getDesignationTheme("OWNER");
      expect(managerTheme.id).toBe("MANAGER");
      expect(ownerTheme.id).toBe("MANAGER");
      expect(managerTheme.activeTab).toContain("bg-amber-600");
    });
  });

  // 10. Custom Staff / Other Workspace Theme
  describe("Custom Staff / Other Theme", () => {
    it("resolves unknown or custom designations to Staff slate theme", () => {
      const customTheme = getDesignationTheme("INVENTORY_ASSISTANT");
      expect(customTheme.id).toBe("STAFF");
      expect(customTheme.activeTab).toContain("bg-slate-800");

      render(
        <StaffWorkHistoryTabs
          designation="INVENTORY_ASSISTANT"
          activeTab="QUEUE"
          assignedCount={1}
          historyCount={6}
        />
      );

      const assignedTab = screen.getByTestId("tab-assigned-items");
      expect(assignedTab.className).toContain("bg-slate-800");
    });
  });

  // 11. Accessibility and semantics
  describe("Accessibility & Semantics", () => {
    it("provides proper tablist and tab roles with keyboard-friendly focus", () => {
      render(
        <StaffWorkHistoryTabs
          designation="CHEF"
          activeTab="QUEUE"
          assignedCount={2}
          historyCount={4}
          ariaLabel="Chef preparation navigation"
        />
      );

      const tablist = screen.getByRole("tablist", { name: "Chef preparation navigation" });
      expect(tablist).toBeInTheDocument();

      const tabs = screen.getAllByRole("tab");
      expect(tabs).toHaveLength(2);
      expect(tabs[0]).toHaveAttribute("aria-selected", "true");
      expect(tabs[1]).toHaveAttribute("aria-selected", "false");
    });
  });
});
