import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Server from "../pages/Server";
import { LanguageProvider } from "../context/LanguageContext";
import { RestaurantThemeProvider } from "../context/ThemeContext";
import { RestaurantContextProvider } from "../context/RestaurantContext";
import { CartProvider } from "../context/CartContext";

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

vi.mock("../utils/apiClient", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    api: {
      get: vi.fn().mockResolvedValue({ data: { success: true, count: 5 } }),
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
    return { data: {}, loading: false, refresh: vi.fn() };
  },
}));

vi.mock("../utils/soundPlayer", () => ({
  playNotificationSound: vi.fn(),
}));

vi.mock("../utils/toast", () => ({
  showToast: vi.fn(),
}));

describe("Server Station Navbar — History & Notifications Icon-Only Buttons", () => {
  const renderServer = (initialRoute = "/server") =>
    render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <LanguageProvider>
          <RestaurantThemeProvider>
            <RestaurantContextProvider>
              <CartProvider>
                <Routes>
                  <Route path="/server" element={<Server />} />
                  <Route path="/server/history" element={<Server />} />
                  <Route path="/server/notifications" element={<Server />} />
                </Routes>
              </CartProvider>
            </RestaurantContextProvider>
          </RestaurantThemeProvider>
        </LanguageProvider>
      </MemoryRouter>
    );

  it("1. History button is icon-only without text beside it, has title and aria-label", async () => {
    renderServer();

    const historyBtn = screen.getByTestId("server-history-nav-btn");
    expect(historyBtn).toBeInTheDocument();

    // Has title="History" and aria-label="History"
    expect(historyBtn).toHaveAttribute("title", "History");
    expect(historyBtn).toHaveAttribute("aria-label", "History");

    // Icon button has compact 40x40 styling
    expect(historyBtn.className).toContain("w-10");
    expect(historyBtn.className).toContain("h-10");
    expect(historyBtn.className).toContain("justify-center");

    // Contains svg icon and no text node with "History"
    expect(historyBtn.querySelector("svg")).not.toBeNull();
    expect(historyBtn.textContent.trim()).toBe("");
  });

  it("2. Notifications button is icon-only without text beside it, has title and aria-label", async () => {
    renderServer();

    const notifBtn = screen.getByTestId("server-notifications-nav-btn");
    expect(notifBtn).toBeInTheDocument();

    // Has title="Notifications" and aria-label="Notifications"
    expect(notifBtn).toHaveAttribute("title", "Notifications");
    expect(notifBtn).toHaveAttribute("aria-label", "Notifications");

    // Icon button has compact 40x40 styling
    expect(notifBtn.className).toContain("w-10");
    expect(notifBtn.className).toContain("h-10");
    expect(notifBtn.className).toContain("justify-center");

    // Contains svg bell icon
    expect(notifBtn.querySelector("svg")).not.toBeNull();
    // Does not have text "Notifications" in button text
    expect(notifBtn.textContent).not.toContain("Notifications");
  });

  it("3. History button opens History view on click", async () => {
    renderServer();

    const historyBtn = screen.getByTestId("server-history-nav-btn");
    fireEvent.click(historyBtn);

    await waitFor(() => {
      expect(screen.getByTestId("server-history-container")).toBeInTheDocument();
    });
  });

  it("4. Notifications button opens Notifications view on click", async () => {
    renderServer();

    const notifBtn = screen.getByTestId("server-notifications-nav-btn");
    fireEvent.click(notifBtn);

    await waitFor(() => {
      expect(screen.getByText(/Real-time alerts for orders/i)).toBeInTheDocument();
    });
  });
});
