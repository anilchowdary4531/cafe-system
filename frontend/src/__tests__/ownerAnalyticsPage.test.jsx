import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import OwnerAnalytics from "../pages/admin/OwnerAnalytics";
import { api } from "../utils/apiClient";
import axios from "axios";

// Mock Recharts for headless JSDOM testing
vi.mock("recharts", () => ({
    ResponsiveContainer: ({ children }) => <div className="recharts-responsive-container">{children}</div>,
    AreaChart: ({ children }) => <div data-testid="area-chart">{children}</div>,
    Area: () => <div data-testid="area" />,
    XAxis: () => <div data-testid="x-axis" />,
    YAxis: () => <div data-testid="y-axis" />,
    Tooltip: () => <div data-testid="tooltip" />,
    PieChart: ({ children }) => <div data-testid="pie-chart">{children}</div>,
    Pie: ({ children }) => <div data-testid="pie">{children}</div>,
    Cell: () => <div data-testid="cell" />,
}));

vi.mock("../components/OwnerMenuButton", () => ({
    default: () => <button data-testid="owner-menu-button">Menu</button>,
}));

vi.mock("../utils/apiClient", () => ({
    api: {
        get: vi.fn(),
    },
}));

vi.mock("axios", () => ({
    default: {
        get: vi.fn(),
    },
}));

const mockAnalyticsData = {
    range: "7d",
    dateDisplayLabel: "Past 7 Days",
    restaurant: {
        id: 1,
        name: "Café King Test",
        timezone: "Asia/Kolkata",
    },
    overview: {
        totalRevenue: 15420.5,
        previousTotalRevenue: 12000,
        revenuePctChange: 28.5,
        totalOrders: 85,
        previousTotalOrders: 70,
        ordersPctChange: 21.4,
        totalCustomers: 64,
        previousTotalCustomers: 50,
        customersPctChange: 28.0,
        avgOrderValue: 181.42,
        previousAvgOrderValue: 171.43,
        aovPctChange: 5.8,
        grossSales: 16000,
        netSales: 15000,
        totalDiscounts: 1000,
        totalTaxes: 420.5,
    },
    realtime: {
        activeQueue: 4,
        delayedTickets: 0,
        avgPrepMinutes: 14.2,
        activeTables: 3,
        totalTables: 10,
        availableTables: 7,
        occupancyRatePct: 30.0,
    },
    tablesAndQr: {
        totalTables: 10,
        occupiedTables: 3,
        availableTables: 7,
        occupancyRatePct: 30.0,
        qrRevenue: 9850,
        qrOrdersCount: 52,
    },
    kitchenFlow: {
        avgPrepTimeMinutes: 14.2,
        delayedOrders: 1,
        delayedOrdersPct: 1.2,
        placed: 2,
        accepted: 1,
        preparing: 3,
        ready: 2,
        delivered: 77,
        totalKOTs: 85,
    },
    paymentMethods: {
        counts: { UPI: 50, CASH: 25, CARD: 10 },
        amounts: { UPI: 9000, CASH: 4500, CARD: 1920.5 },
        successRatePct: 98.8,
    },
    customerStats: {
        totalCustomers: 64,
        newCustomers: 45,
        returningCustomers: 19,
        repeatRatePct: 29.7,
    },
    inventoryStatus: {
        healthyCount: 22,
        lowStockCount: 2,
        outOfStockCount: 0,
        lowStockItems: ["Milk", "Coffee Beans"],
    },
    charts: {
        timeseries: [
            { ts: "2026-10-01", displayDate: "01 Oct", revenue: 2100, orders: 12, customers: 10 },
        ],
        topItems: [
            { name: "Espresso", qty: 40, revenue: 4800 },
        ],
        categories: [
            { name: "Beverages", value: 8000 },
        ],
        tableHeatmap: [
            { tableNo: "T1", orders: 15, revenue: 3200 },
        ],
    },
    staffPerformance: [
        { name: "John Doe", orders: 30, revenue: 5500 },
    ],
    alerts: [
        { id: "all-systems-healthy", title: "All operational systems operating normally", severity: "info" },
    ],
};

describe("OwnerAnalytics Component — UI and Workflow Verification", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.setItem("user", JSON.stringify({ id: 1, role: "OWNER", restaurantId: 1 }));
    });

    it("1. Successfully fetches and displays analytics overview metrics and header", async () => {
        api.get.mockResolvedValueOnce({ data: mockAnalyticsData });

        render(
            <MemoryRouter initialEntries={["/owner/analytics?range=7d"]}>
                <OwnerAnalytics />
            </MemoryRouter>
        );

        // Header
        expect(await screen.findByText(/Café King Test Intelligence/i)).toBeInTheDocument();
        expect(screen.getByText(/ENTERPRISE CONSOLE/i)).toBeInTheDocument();

        // Overview KPI values
        expect(screen.getByText("₹15,420.50")).toBeInTheDocument(); // Revenue
        expect(screen.getByText("85")).toBeInTheDocument(); // Orders
        expect(screen.getByText("64")).toBeInTheDocument(); // Customers
        expect(screen.getByText("₹181.42")).toBeInTheDocument(); // Avg Order Value

        // Quick operational metrics
        expect(screen.getByText(/4 active/i)).toBeInTheDocument(); // Kitchen active queue
        expect(screen.getByText(/3\/10/i)).toBeInTheDocument(); // Table occupancy
    });

    it("2. Displays all 11 navigation section tabs", async () => {
        api.get.mockResolvedValueOnce({ data: mockAnalyticsData });

        render(
            <MemoryRouter initialEntries={["/owner/analytics"]}>
                <OwnerAnalytics />
            </MemoryRouter>
        );

        await screen.findByText(/Café King Test Intelligence/i);

        const expectedTabs = [
            "Overview", "Sales", "Orders", "Tables", "Customers",
            "Menu", "Kitchen", "Payments", "Inventory", "Staff", "Reports"
        ];

        const nav = screen.getByRole("navigation");
        expectedTabs.forEach((tab) => {
            expect(screen.getByRole("navigation").querySelector(`button[type="button"]`)).toBeInTheDocument();
            expect(screen.getAllByRole("button", { name: tab }).length).toBeGreaterThan(0);
        });
    });

    it("3. Displays Date Presets and toggles range on click", async () => {
        api.get.mockResolvedValue({ data: mockAnalyticsData });

        render(
            <MemoryRouter initialEntries={["/owner/analytics?range=7d"]}>
                <OwnerAnalytics />
            </MemoryRouter>
        );

        await screen.findByText(/Café King Test Intelligence/i);

        const todayBtn = screen.getByRole("button", { name: "Today" });
        expect(todayBtn).toBeInTheDocument();

        fireEvent.click(todayBtn);

        await waitFor(() => {
            expect(api.get).toHaveBeenCalledWith(
                "/owner/1/analytics",
                expect.objectContaining({
                    params: expect.objectContaining({ range: "today" }),
                })
            );
        });
    });

    it("4. Switches sections when clicking tabs (e.g. Reports tab)", async () => {
        api.get.mockResolvedValue({ data: mockAnalyticsData });

        render(
            <MemoryRouter initialEntries={["/owner/analytics"]}>
                <OwnerAnalytics />
            </MemoryRouter>
        );

        await screen.findByText(/Café King Test Intelligence/i);

        const reportsTab = screen.getByRole("button", { name: "Reports" });
        fireEvent.click(reportsTab);

        expect(await screen.findByText(/EXECUTIVE REPORT DIRECTORY/i)).toBeInTheDocument();
        expect(screen.getByText("Sales Report")).toBeInTheDocument();
        expect(screen.getByText("KOT Report")).toBeInTheDocument();
    });

    it("5. Displays error banner with Retry button when API fails, and clicking Retry triggers refetch", async () => {
        api.get.mockRejectedValueOnce(new Error("Network connection error"));
        axios.get.mockRejectedValueOnce(new Error("Network connection error"));

        render(
            <MemoryRouter initialEntries={["/owner/analytics"]}>
                <OwnerAnalytics />
            </MemoryRouter>
        );

        const retryBtn = await screen.findByRole("button", { name: /Retry/i });
        expect(retryBtn).toBeInTheDocument();
        expect(screen.getByText(/Network connection error/i)).toBeInTheDocument();

        // Successful response on retry
        api.get.mockResolvedValueOnce({ data: mockAnalyticsData });
        fireEvent.click(retryBtn);

        expect(await screen.findByText("₹15,420.50")).toBeInTheDocument();
    });

    it("6. Refresh button triggers refetch", async () => {
        api.get.mockResolvedValue({ data: mockAnalyticsData });

        render(
            <MemoryRouter initialEntries={["/owner/analytics"]}>
                <OwnerAnalytics />
            </MemoryRouter>
        );

        await screen.findByText(/Café King Test Intelligence/i);

        const refreshBtn = screen.getByRole("button", { name: /Refresh/i });
        fireEvent.click(refreshBtn);

        await waitFor(() => {
            expect(api.get).toHaveBeenCalledTimes(2);
        });
    });
});
