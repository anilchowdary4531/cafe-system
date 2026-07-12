import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("../components/Navbar", () => ({
    default: () => <div data-testid="navbar">Navbar</div>,
}));

vi.mock("../components/Footer", () => ({
    default: () => <div data-testid="footer">Footer</div>,
}));

vi.mock("../pages/Landing", () => ({
    default: () => <div data-testid="landing">Landing</div>,
}));

vi.mock("../pages/Cart", () => ({
    default: () => <div data-testid="cart">Cart</div>,
}));

vi.mock("../pages/Login", () => ({
    default: () => <div data-testid="login">Login</div>,
}));

vi.mock("../pages/Profile", () => ({
    default: ({ section }) => <div data-testid="profile" data-section={section}>Profile {section}</div>,
}));

vi.mock("../pages/ThankYou", () => ({
    default: () => <div data-testid="thank-you">ThankYou</div>,
}));

vi.mock("../pages/Admin", () => ({
    default: () => <div data-testid="admin-page">Admin</div>,
}));

vi.mock("../pages/Orders", () => ({
    default: () => <div data-testid="orders-page">Orders</div>,
}));

vi.mock("../pages/Tables", () => ({
    default: () => <div data-testid="tables-page">Tables</div>,
}));

vi.mock("../pages/Dashboard", () => ({
    default: () => <div data-testid="dashboard-page">Dashboard</div>,
}));

vi.mock("../layouts/AdminLayout", () => ({
    default: () => <Outlet />,
}));

vi.mock("../context/AuthContext", () => ({
    default: ({ children }) => <>{children}</>,
}));

vi.mock("../routes/ProtectedRoute", () => ({
    default: ({ children }) => <>{children}</>,
}));

vi.mock("../context/StaffSocketContext.jsx", () => ({
    StaffSocketProvider: ({ children }) => <>{children}</>,
}));

vi.mock("../pages/admin/OwnerDashboard", () => ({
    default: () => <div data-testid="owner-dashboard">OwnerDashboard</div>,
}));
vi.mock("../pages/admin/OwnerOrders", () => ({
    default: ({ sourceFilter }) => (
        <div data-testid={sourceFilter ? "owner-online-orders" : "owner-orders"}>
            OwnerOrders {sourceFilter || "ALL"}
        </div>
    ),
}));
vi.mock("../pages/admin/MenuStudio", () => ({
    default: () => <div data-testid="owner-menu">MenuStudio</div>,
}));
vi.mock("../pages/admin/OwnerTables", () => ({
    default: () => <div data-testid="owner-tables">OwnerTables</div>,
}));
vi.mock("../pages/admin/OwnerKitchenLive", () => ({
    default: () => <div data-testid="owner-kitchen">OwnerKitchenLive</div>,
}));
vi.mock("../pages/admin/OwnerAnalytics", () => ({
    default: () => <div data-testid="owner-analytics">OwnerAnalytics</div>,
}));
vi.mock("../pages/admin/OwnerFinance", () => ({
    default: () => <div data-testid="owner-finance">OwnerFinance</div>,
}));
vi.mock("../pages/admin/OwnerStaff", () => ({
    default: () => <div data-testid="owner-staff">OwnerStaff</div>,
}));
vi.mock("../pages/admin/OwnerSettings", () => ({
    default: () => <div data-testid="owner-settings">OwnerSettings</div>,
}));
vi.mock("../pages/admin/OwnerNotifications", () => ({
    default: () => <div data-testid="owner-notifications">OwnerNotifications</div>,
}));
vi.mock("../pages/restaurant/RestaurantPublicMenu", () => ({
    default: () => <div data-testid="restaurant-public-menu">RestaurantPublicMenu</div>,
}));
vi.mock("../pages/restaurant/RestaurantMenu", () => ({
    default: () => <div data-testid="restaurant-menu">RestaurantMenu</div>,
}));
vi.mock("../pages/super-admin/SuperAdminDashboard", () => ({
    default: () => <div data-testid="super-admin-dashboard">SuperAdminDashboard</div>,
}));
vi.mock("../pages/super-admin/SuperAdminCreateRestaurant", () => ({
    default: () => <div data-testid="super-admin-create-restaurant">SuperAdminCreateRestaurant</div>,
}));
vi.mock("../pages/super-admin/SuperAdminUsers", () => ({
    default: () => <div data-testid="super-admin-users">SuperAdminUsers</div>,
}));
vi.mock("../pages/super-admin/SuperAdminSettings", () => ({
    default: () => <div data-testid="super-admin-settings">SuperAdminSettings</div>,
}));
vi.mock("../pages/admin/NewOrder.jsx", () => ({
    default: () => <div data-testid="new-order">NewOrder</div>,
}));
vi.mock("../pages/admin/PaymentSuccess.jsx", () => ({
    default: () => <div data-testid="payment-success">PaymentSuccess</div>,
}));
vi.mock("../pages/Kitchen.jsx", () => ({
    default: () => <div data-testid="kitchen-page">Kitchen</div>,
}));
vi.mock("../pages/KitchenChefDetail.jsx", () => ({
    default: () => <div data-testid="chef-detail">ChefDetail</div>,
}));
vi.mock("../pages/StaffProfile.jsx", () => ({
    default: () => <div data-testid="staff-profile">StaffProfile</div>,
}));
vi.mock("../pages/Server.jsx", () => ({
    default: () => <div data-testid="server-page">Server</div>,
}));
vi.mock("../layouts/OwnerLayout.jsx", () => ({
    default: () => <Outlet />,
}));

import App from "../App";

const renderAt = (path) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <App />
        </MemoryRouter>
    );

describe("super admin pages", () => {
    it("renders the super admin dashboard", () => {
        renderAt("/super-admin");
        expect(screen.getByTestId("super-admin-dashboard")).toBeInTheDocument();
    });

    it("renders the create restaurant page", () => {
        renderAt("/super-admin/create-restaurant");
        expect(screen.getByTestId("super-admin-create-restaurant")).toBeInTheDocument();
    });

    it("renders the users page", () => {
        renderAt("/super-admin/users");
        expect(screen.getByTestId("super-admin-users")).toBeInTheDocument();
    });

    it("renders the settings page", () => {
        renderAt("/super-admin/settings");
        expect(screen.getByTestId("super-admin-settings")).toBeInTheDocument();
    });
});

describe("restaurant customer menu pages", () => {
    it("renders the restaurant landing page", () => {
        renderAt("/r/tiffzy");
        expect(screen.getByTestId("landing")).toBeInTheDocument();
    });

    it("renders the public restaurant menu page", () => {
        renderAt("/r/tiffzy/menu");
        expect(screen.getByTestId("restaurant-public-menu")).toBeInTheDocument();
    });

    it("renders the ordering menu page", () => {
        renderAt("/m/tiffzy/table-12");
        expect(screen.getByTestId("restaurant-menu")).toBeInTheDocument();
    });

    it("renders the debug ordering menu page", () => {
        renderAt("/debug/menu/tiffzy/table-12");
        expect(screen.getByTestId("restaurant-menu")).toBeInTheDocument();
    });
});

describe("public navigation aliases", () => {
    it("redirects the profile root to the overview section", () => {
        renderAt("/profile");

        expect(screen.getByTestId("profile")).toHaveAttribute("data-section", "overview");
    });

    it("redirects the legacy order history route to the profile order history page", () => {
        renderAt("/orders/history");

        expect(screen.getByTestId("profile")).toHaveAttribute("data-section", "orders");
    });

    it("redirects the kitchen assignment route back to the kitchen page", () => {
        renderAt("/kitchen/assigned-items");

        expect(screen.getByTestId("kitchen-page")).toBeInTheDocument();
    });
});

describe("owner panel pages", () => {
    it("renders the owner dashboard", () => {
        renderAt("/owner");
        expect(screen.getByTestId("owner-dashboard")).toBeInTheDocument();
    });

    it("renders the owner orders page", () => {
        renderAt("/owner/orders");
        expect(screen.getByTestId("owner-orders")).toBeInTheDocument();
    });

    it("renders the owner online orders page", () => {
        renderAt("/owner/online-orders");
        expect(screen.getByTestId("owner-online-orders")).toBeInTheDocument();
    });

    it("renders the menu studio page", () => {
        renderAt("/owner/menu");
        expect(screen.getByTestId("owner-menu")).toBeInTheDocument();
    });

    it("renders the owner tables page", () => {
        renderAt("/owner/tables");
        expect(screen.getByTestId("owner-tables")).toBeInTheDocument();
    });

    it("renders the owner kitchen page", () => {
        renderAt("/owner/kitchen");
        expect(screen.getByTestId("owner-kitchen")).toBeInTheDocument();
    });

    it("renders the owner analytics page", () => {
        renderAt("/owner/analytics");
        expect(screen.getByTestId("owner-analytics")).toBeInTheDocument();
    });

    it("renders the owner finance page", () => {
        renderAt("/owner/finance");
        expect(screen.getByTestId("owner-finance")).toBeInTheDocument();
    });

    it("renders the owner staff page", () => {
        renderAt("/owner/staff");
        expect(screen.getByTestId("owner-staff")).toBeInTheDocument();
    });

    it("renders the owner settings page", () => {
        renderAt("/owner/settings");
        expect(screen.getByTestId("owner-settings")).toBeInTheDocument();
    });

    it("renders the owner notifications page", () => {
        renderAt("/owner/notifications");
        expect(screen.getByTestId("owner-notifications")).toBeInTheDocument();
    });
});

describe("admin panel pages", () => {
    it("renders the admin dashboard", () => {
        renderAt("/admin");
        expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
    });

    it("renders the admin menu page", () => {
        renderAt("/admin/menu");
        expect(screen.getByTestId("admin-page")).toBeInTheDocument();
    });

    it("renders the admin orders page", () => {
        renderAt("/admin/orders");
        expect(screen.getByTestId("orders-page")).toBeInTheDocument();
    });

    it("renders the admin tables page", () => {
        renderAt("/admin/tables");
        expect(screen.getByTestId("tables-page")).toBeInTheDocument();
    });
});

describe("404 fallback", () => {
    it("renders the not found page for unknown routes", () => {
        renderAt("/not-a-real-route");
        expect(screen.getByText("404 - Page Not Found")).toBeInTheDocument();
    });
});
