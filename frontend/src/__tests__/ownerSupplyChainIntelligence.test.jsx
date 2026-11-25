import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import OwnerSupplyChainIntelligence from "../pages/admin/OwnerSupplyChainIntelligence";
import OwnerSupplyChainReports from "../pages/admin/OwnerSupplyChainReports";
import ErrorBoundary from "../components/ErrorBoundary";
import { api } from "../utils/apiClient";

vi.mock("../utils/apiClient", () => ({
    api: {
        get: vi.fn(),
        post: vi.fn(),
    },
}));

vi.mock("../utils/toast", () => ({
    showToast: vi.fn(),
}));

// Stub Recharts ResponsiveContainer for jsdom
vi.mock("recharts", async () => {
    const actual = await vi.importActual("recharts");
    return {
        ...actual,
        ResponsiveContainer: ({ children }) => <div data-testid="recharts-container">{children}</div>,
    };
});

function mockEmptyApis() {
    api.get.mockImplementation((url) => {
        if (url === "/supply-orders") return Promise.resolve({ data: { orders: [] } });
        if (url === "/owner/suppliers") return Promise.resolve({ data: { suppliers: [] } });
        if (url === "/owner/negotiations") return Promise.resolve({ data: { negotiations: [] } });
        if (url === "/owner/supply-payments") return Promise.resolve({ data: { summary: null } });
        if (url === "/owner/storage-locations") return Promise.resolve({ data: { locations: [] } });
        if (url.includes("/inventory/materials")) return Promise.resolve({ data: { materials: [] } });
        return Promise.resolve({ data: {} });
    });
}

function mockPopulatedApis() {
    const nowIso = new Date().toISOString();
    api.get.mockImplementation((url) => {
        if (url === "/supply-orders") {
            return Promise.resolve({
                data: {
                    orders: [
                        {
                            id: 10,
                            supplierId: 1,
                            totalAmount: 12000,
                            subtotal: 12500,
                            discountAmount: 500,
                            status: "DELIVERED",
                            createdAt: nowIso,
                            updatedAt: nowIso,
                            expectedDeliveryDate: new Date(Date.now() + 86400000).toISOString(),
                            statusEvents: [{ status: "DELIVERED", createdAt: nowIso }],
                            items: [{ productId: 101, productName: "Red Onions", category: "Produce" }],
                        },
                        {
                            id: 11,
                            supplierId: 2,
                            totalAmount: 8000,
                            subtotal: 8000,
                            discountAmount: 0,
                            status: "PLACED",
                            createdAt: nowIso,
                            notes: "Created from negotiation NEG-1001",
                            items: [{ productId: 202, productName: "Paneer Block", category: "Dairy" }],
                        },
                    ],
                },
            });
        }
        if (url === "/owner/suppliers") {
            return Promise.resolve({
                data: {
                    suppliers: [
                        {
                            id: 1,
                            profile: { businessName: "Deccan Agro Farms" },
                            addresses: [{ state: "Telangana", isPrimary: true }],
                            products: [{ id: 101, category: { name: "Produce" } }],
                        },
                        {
                            id: 2,
                            profile: { businessName: "Krishna Dairy Co" },
                            addresses: [{ state: "Karnataka", isPrimary: true }],
                            products: [{ id: 202, category: { name: "Dairy" } }],
                        },
                    ],
                },
            });
        }
        if (url === "/owner/negotiations") return Promise.resolve({ data: { negotiations: [] } });
        if (url === "/owner/supply-payments") {
            return Promise.resolve({
                data: { metrics: { paidAmount: 12000, pendingAmount: 5000, overdueAmount: 3000 } },
            });
        }
        if (url === "/owner/storage-locations") {
            return Promise.resolve({ data: { locations: [{ id: 5, name: "Cold Room", items: [] }] } });
        }
        if (url.includes("/inventory/materials")) {
            return Promise.resolve({ data: { materials: [{ id: 1, name: "Red Onions", category: "Produce", currentStock: 10, minimumStock: 2, costPerBaseUnit: 40 }] } });
        }
        return Promise.resolve({ data: {} });
    });
}

describe("OwnerSupplyChainIntelligence — Phase 1 Cleanup", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.setItem("user", JSON.stringify({ id: 7, role: "OWNER", restaurantId: 42 }));
    });

    it("renders initial loading skeleton before data resolves", () => {
        api.get.mockImplementation(() => new Promise(() => {}));
        render(
            <MemoryRouter initialEntries={["/owner/supply-chain"]}>
                <OwnerSupplyChainIntelligence />
            </MemoryRouter>
        );
        expect(screen.getByTestId("supply-analytics-loading")).toBeInTheDocument();
    });

    it("calls only owner-scoped endpoints, never /super-admin/* or /api/*, and shows no mock fallbacks when empty", async () => {
        mockEmptyApis();
        render(
            <MemoryRouter initialEntries={["/owner/supply-chain"]}>
                <OwnerSupplyChainIntelligence />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(api.get).toHaveBeenCalledWith("/supply-orders");
            expect(api.get).toHaveBeenCalledWith("/owner/suppliers");
            expect(api.get).toHaveBeenCalledWith("/owner/negotiations");
            expect(api.get).toHaveBeenCalledWith("/owner/supply-payments");
            expect(api.get).toHaveBeenCalledWith("/owner/storage-locations");
            expect(api.get).toHaveBeenCalledWith("/owner/42/inventory/materials");
        });

        const calledUrls = api.get.mock.calls.map((c) => c[0]);
        expect(calledUrls.some((u) => u.includes("super-admin"))).toBe(false);
        expect(calledUrls.some((u) => u.startsWith("/api/"))).toBe(false);

        expect(await screen.findByText(/No supplier data for this period/i)).toBeInTheDocument();
        expect(screen.queryByText(/FarmFresh Vegetables Co\./i)).toBeNull();
        expect(screen.queryByText(/Royal Spices & Condiments/i)).toBeNull();
        expect(screen.queryByText(/148,500/)).toBeNull();
        expect(screen.queryByText(/Top Restaurant Customers/i)).toBeNull();
        expect(screen.queryByLabelText(/buyer/i)).toBeNull();
    });

    it("does not fall back to restaurantId 1 when user.restaurantId is missing", async () => {
        localStorage.setItem("user", JSON.stringify({ id: 7, role: "OWNER" }));
        mockEmptyApis();
        render(
            <MemoryRouter initialEntries={["/owner/supply-chain"]}>
                <OwnerSupplyChainIntelligence />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(api.get).toHaveBeenCalledWith("/supply-orders");
        });
        const calledUrls = api.get.mock.calls.map((c) => c[0]);
        expect(calledUrls.some((u) => u.includes("/owner/1/inventory"))).toBe(false);
    });

    it("supports supplier, product, channel, custom date filters and Reset", async () => {
        mockPopulatedApis();
        render(
            <MemoryRouter initialEntries={["/owner/supply-chain"]}>
                <OwnerSupplyChainIntelligence />
            </MemoryRouter>
        );

        expect(await screen.findByRole("cell", { name: "Deccan Agro Farms" })).toBeInTheDocument();
        expect(screen.getByRole("cell", { name: "Krishna Dairy Co" })).toBeInTheDocument();

        // Filter by Supplier 1
        fireEvent.change(screen.getByLabelText("Filter by supplier"), { target: { value: "1" } });
        expect(screen.getByRole("cell", { name: "Deccan Agro Farms" })).toBeInTheDocument();
        expect(screen.queryByRole("cell", { name: "Krishna Dairy Co" })).toBeNull();

        // Reset, then filter by Product
        fireEvent.click(screen.getByRole("button", { name: "Reset" }));
        expect(screen.getByRole("cell", { name: "Krishna Dairy Co" })).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText("Filter by product"), { target: { value: "Paneer Block" } });
        expect(screen.getByRole("cell", { name: "Krishna Dairy Co" })).toBeInTheDocument();
        expect(screen.queryByRole("cell", { name: "Deccan Agro Farms" })).toBeNull();

        // Switch to Custom range -> custom date inputs appear
        fireEvent.click(screen.getByRole("button", { name: "Custom" }));
        expect(screen.getByLabelText("Custom start date")).toBeInTheDocument();
        expect(screen.getByLabelText("Custom end date")).toBeInTheDocument();

        // Reset restores all filters and date range
        fireEvent.click(screen.getByRole("button", { name: "Reset" }));
        expect(screen.getByLabelText("Filter by supplier").value).toBe("ALL");
        expect(screen.getByLabelText("Filter by product").value).toBe("ALL");
        expect(screen.queryByLabelText("Custom start date")).toBeNull();
        expect(screen.getByRole("cell", { name: "Deccan Agro Farms" })).toBeInTheDocument();
        expect(screen.getByRole("cell", { name: "Krishna Dairy Co" })).toBeInTheDocument();
    });

    it("shows error banner with Retry when all endpoints fail and partial warning when one fails", async () => {
        api.get.mockRejectedValue(new Error("Network down"));
        const { unmount } = render(
            <MemoryRouter initialEntries={["/owner/supply-chain"]}>
                <OwnerSupplyChainIntelligence />
            </MemoryRouter>
        );

        expect(await screen.findByRole("alert")).toHaveTextContent(/Failed to load procurement/i);
        expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
        unmount();

        // Partial failure test
        api.get.mockImplementation((url) => {
            if (url === "/owner/negotiations") return Promise.reject(new Error("Timeout"));
            if (url === "/supply-orders") return Promise.resolve({ data: { orders: [] } });
            if (url === "/owner/suppliers") return Promise.resolve({ data: { suppliers: [] } });
            if (url === "/owner/supply-payments") return Promise.resolve({ data: { summary: null } });
            if (url === "/owner/storage-locations") return Promise.resolve({ data: { locations: [] } });
            return Promise.resolve({ data: { materials: [] } });
        });
        render(
            <MemoryRouter initialEntries={["/owner/supply-chain"]}>
                <OwnerSupplyChainIntelligence />
            </MemoryRouter>
        );
        expect(await screen.findByRole("status")).toHaveTextContent(/Partial data unavailable: Negotiations/i);
    });

    it("switches between Overview, Supplier, and Controls tabs", async () => {
        mockPopulatedApis();
        render(
            <MemoryRouter initialEntries={["/owner/supply-chain"]}>
                <OwnerSupplyChainIntelligence />
            </MemoryRouter>
        );

        await screen.findByRole("cell", { name: "Deccan Agro Farms" });
        fireEvent.click(screen.getByRole("tab", { name: "Controls" }));
        expect(screen.getByText(/Warehouse Stock Snapshot/i)).toBeInTheDocument();

        fireEvent.click(screen.getByRole("tab", { name: "Supplier" }));
        expect(screen.getByText(/Supplier Performance Scorecard/i)).toBeInTheDocument();
    });

    it("renders all 12 Supply Chain module tabs in-page while keeping the shared shell visible", async () => {
        mockPopulatedApis();
        render(
            <MemoryRouter initialEntries={["/owner/supply-chain"]}>
                <OwnerSupplyChainIntelligence />
            </MemoryRouter>
        );

        await screen.findByRole("cell", { name: "Deccan Agro Farms" });

        const moduleTabs = [
            "Inventory",
            "Purchasing",
            "Suppliers",
            "Warehouse",
            "Recipes",
            "Wastage",
            "Marketplace",
            "Negotiations",
            "Payments",
            "Intelligence",
            "Settings",
        ];

        for (const label of moduleTabs) {
            const tabBtn = screen.getByRole("tab", { name: label });
            fireEvent.click(tabBtn);
            expect(tabBtn).toHaveAttribute("aria-selected", "true");
            expect(screen.getByRole("heading", { name: /Supplier Performance & Procurement Analytics/i })).toBeInTheDocument();
            expect(screen.getByLabelText("Filter by supplier")).toBeInTheDocument();
            expect(screen.getByTestId("supply-chain-module-panel")).toBeInTheDocument();
        }

        // Verify Tier 2 sub-tab under Inventory works in-page
        fireEvent.click(screen.getByRole("tab", { name: "Inventory" }));
        const lowStockTab = await screen.findByRole("tab", { name: "Low Stock" });
        fireEvent.click(lowStockTab);
        expect(lowStockTab).toHaveAttribute("aria-selected", "true");
        expect(screen.getByTestId("supply-chain-module-panel")).toBeInTheDocument();

        // Return to Overview tab
        const moduleNav = screen.getByRole("tablist", { name: "Supply Chain modules" });
        const overviewTab = within(moduleNav).getByRole("tab", { name: "Overview" });
        fireEvent.click(overviewTab);
        expect(overviewTab).toHaveAttribute("aria-selected", "true");
        expect(screen.queryByTestId("supply-chain-module-panel")).toBeNull();
        expect(await screen.findByRole("cell", { name: "Deccan Agro Farms" })).toBeInTheDocument();
    });

    it("renders OwnerSupplyChainReports without ReferenceError: OwnerMenuButton is not defined", async () => {
        api.get.mockResolvedValue({
            data: {
                metrics: { totalPurchaseValue: 0, inventoryValue: 0, foodCostPct: 0, wastageValue: 0, wastagePct: 0, lowStockCount: 0 },
                purchaseAnalytics: { purchaseTrend: [], purchaseBySupplier: [], purchaseByCategory: [] },
                inventoryAnalytics: { lowStockItems: [] },
                wastageAnalytics: { topWastedIngredients: [] },
                supplierPerformance: [],
                recommendations: [],
            },
        });

        render(
            <ErrorBoundary>
                <MemoryRouter initialEntries={["/owner/supply-chain/reports"]}>
                    <OwnerSupplyChainReports />
                </MemoryRouter>
            </ErrorBoundary>
        );

        expect(await screen.findByRole("heading", { name: /Supply Chain Intelligence & Analytics/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Open navigation menu/i })).toBeInTheDocument();
        expect(screen.queryByText(/OwnerMenuButton is not defined/i)).toBeNull();
    });

    it("maps Financial view from /owner/supply-payments metrics and filters orders by product category", async () => {
        const nowIso = new Date().toISOString();
        api.get.mockImplementation((url) => {
            if (url === "/supply-orders") {
                return Promise.resolve({
                    data: {
                        orders: [
                            {
                                id: 10,
                                supplierId: 1,
                                totalAmount: 12000,
                                subtotal: 12000,
                                discountAmount: 0,
                                status: "DELIVERED",
                                createdAt: nowIso,
                                items: [{ productId: 101, productName: "Red Onions" }],
                            },
                            {
                                id: 11,
                                supplierId: 2,
                                totalAmount: 8000,
                                subtotal: 8000,
                                discountAmount: 0,
                                status: "PLACED",
                                createdAt: nowIso,
                                items: [{ productId: 202, productName: "Paneer Block" }],
                            },
                        ],
                    },
                });
            }
            if (url === "/owner/suppliers") {
                return Promise.resolve({
                    data: {
                        suppliers: [
                            {
                                id: 1,
                                profile: { businessName: "Deccan Agro Farms" },
                                addresses: [{ state: "Telangana", isPrimary: true }],
                                products: [{ id: 101, category: { id: 1, name: "Produce" } }],
                            },
                            {
                                id: 2,
                                profile: { businessName: "Krishna Dairy Co" },
                                addresses: [{ state: "Karnataka", isPrimary: true }],
                                products: [{ id: 202, category: { id: 2, name: "Dairy" } }],
                            },
                        ],
                    },
                });
            }
            if (url === "/owner/supply-payments") {
                return Promise.resolve({
                    data: { metrics: { paidAmount: 45000, pendingAmount: 5000, overdueAmount: 3500 } },
                });
            }
            if (url === "/owner/negotiations") return Promise.resolve({ data: { negotiations: [] } });
            if (url === "/owner/storage-locations") return Promise.resolve({ data: { locations: [] } });
            return Promise.resolve({ data: { materials: [] } });
        });

        render(
            <MemoryRouter initialEntries={["/owner/supply-chain"]}>
                <OwnerSupplyChainIntelligence />
            </MemoryRouter>
        );

        expect(await screen.findByRole("cell", { name: "Deccan Agro Farms" })).toBeInTheDocument();
        expect(screen.getByRole("cell", { name: "Krishna Dairy Co" })).toBeInTheDocument();

        // Financial view reads metrics.paidAmount and pending + overdue
        fireEvent.click(screen.getByRole("button", { name: "Financial" }));
        expect(screen.getByText("₹45,000.00")).toBeInTheDocument();
        expect(screen.getByText("₹8,500.00")).toBeInTheDocument();

        // Category filter maps productId -> supplier product.category.name
        const categorySelect = screen.getByLabelText("Filter by category");
        fireEvent.change(categorySelect, { target: { value: "Dairy" } });
        expect(screen.getByRole("cell", { name: "Krishna Dairy Co" })).toBeInTheDocument();
        expect(screen.queryByRole("cell", { name: "Deccan Agro Farms" })).toBeNull();

        fireEvent.change(categorySelect, { target: { value: "Produce" } });
        expect(screen.getByRole("cell", { name: "Deccan Agro Farms" })).toBeInTheDocument();
        expect(screen.queryByRole("cell", { name: "Krishna Dairy Co" })).toBeNull();

        fireEvent.change(categorySelect, { target: { value: "ALL" } });
        expect(screen.getByRole("cell", { name: "Deccan Agro Farms" })).toBeInTheDocument();
        expect(screen.getByRole("cell", { name: "Krishna Dairy Co" })).toBeInTheDocument();
    });
});
