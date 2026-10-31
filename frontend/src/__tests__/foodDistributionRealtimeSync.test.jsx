import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Server from "../pages/Server.jsx";
import { LanguageProvider } from "../context/LanguageContext.jsx";
import { RestaurantThemeProvider } from "../context/ThemeContext.jsx";
import { RestaurantContextProvider } from "../context/RestaurantContext.jsx";
import { CartProvider } from "../context/CartContext.jsx";
import { api } from "../utils/apiClient.js";

const mockTables = [
    {
        id: 8,
        tableNo: "1",
        section: "Main Hall",
        seats: 4,
        isOccupied: true,
        assignedWaiterId: 101,
        assignedWaiterName: "Server Suresh",
        activeOrders: [],
    },
    {
        id: 12,
        tableNo: "table 1",
        section: "TABLE",
        seats: 4,
        isOccupied: false,
        assignedWaiterId: null,
        activeOrders: [],
    },
];

let mockCanonicalReadyItems = [];
const mockRefreshCanonicalReady = vi.fn();
const mockSocketListeners = {};

vi.mock("../utils/apiClient.js", () => {
    const mockApi = {
        get: vi.fn().mockResolvedValue({ data: { success: true } }),
        post: vi.fn().mockResolvedValue({ data: { success: true } }),
        put: vi.fn().mockResolvedValue({ data: { success: true, ok: true } }),
        delete: vi.fn().mockResolvedValue({ data: { success: true } }),
        interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() },
        },
    };
    return {
        api: mockApi,
        default: mockApi,
    };
});

vi.mock("../hooks/useCachedGet", () => ({
    default: (url) => {
        const urlStr = String(url || "");
        if (urlStr.includes("food-runner-items") || urlStr.includes("/kitchen/ready-items") || urlStr.includes("/ready-items")) {
            return {
                data: {
                    success: true,
                    count: mockCanonicalReadyItems.length,
                    items: mockCanonicalReadyItems,
                },
                loading: false,
                refresh: mockRefreshCanonicalReady,
            };
        }
        if (urlStr.includes("/tables")) {
            return { data: { tables: mockTables }, loading: false, refresh: vi.fn() };
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
        if (urlStr.includes("/orders")) {
            return { data: { orders: [] }, loading: false, refresh: vi.fn() };
        }
        return { data: null, loading: false, refresh: vi.fn() };
    },
}));

vi.mock("../context/AuthContext.jsx", () => ({
    useAuth: () => ({
        user: { id: 101, restaurantId: 1, name: "Server Suresh", role: "SERVER" },
        logout: vi.fn(),
    }),
}));

vi.mock("../context/StaffSocketContext.jsx", () => ({
    useStaffSocket: () => ({
        socket: {
            on: vi.fn((event, cb) => {
                mockSocketListeners[event] = cb;
            }),
            off: vi.fn((event) => {
                delete mockSocketListeners[event];
            }),
            emit: vi.fn(),
        },
        isConnected: true,
    }),
}));

describe("FOOD DISTRIBUTION REALTIME SYNCHRONIZATION FRONTEND SUITE", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCanonicalReadyItems = [];
    });

    it("1. Server Pass renders ready items for Main Hall Table 1 with canonical table identity", async () => {
        mockCanonicalReadyItems = [
            {
                id: 101,
                kotItemId: 101,
                kotId: 501,
                kotNo: "KOT-501",
                orderId: 1001,
                orderNo: "ORD-1001",
                tableId: 8,
                tableNo: "1",
                section: "Main Hall",
                itemName: "Butter Chicken",
                qty: 1,
                status: "READY",
            },
        ];

        render(
            <MemoryRouter>
                <RestaurantContextProvider>
                    <RestaurantThemeProvider>
                        <LanguageProvider>
                            <CartProvider>
                                <Server />
                            </CartProvider>
                        </LanguageProvider>
                    </RestaurantThemeProvider>
                </RestaurantContextProvider>
            </MemoryRouter>
        );

        const headerBtn = await screen.findByTestId("server-ready-distribute-nav-btn");
        expect(headerBtn).toHaveTextContent("1");
        expect(screen.getByText("Butter Chicken")).toBeInTheDocument();
        expect(screen.getByText("#KOT-501")).toBeInTheDocument();
        expect(screen.getByText("Table 1")).toBeInTheDocument();
    });

    it("2. Distributing Butter Chicken marks it SERVED and calls API", async () => {
        mockCanonicalReadyItems = [
            {
                id: 101,
                kotItemId: 101,
                kotId: 501,
                kotNo: "KOT-501",
                orderId: 1001,
                orderNo: "ORD-1001",
                tableId: 8,
                tableNo: "1",
                section: "Main Hall",
                itemName: "Butter Chicken",
                qty: 1,
                status: "READY",
            },
        ];

        render(
            <MemoryRouter>
                <RestaurantContextProvider>
                    <RestaurantThemeProvider>
                        <LanguageProvider>
                            <CartProvider>
                                <Server />
                            </CartProvider>
                        </LanguageProvider>
                    </RestaurantThemeProvider>
                </RestaurantContextProvider>
            </MemoryRouter>
        );

        const markServedBtn = await screen.findByRole("button", { name: /Served \/ Distributed/i });
        fireEvent.click(markServedBtn);

        await waitFor(() => {
            expect(api.put).toHaveBeenCalledWith(
                expect.stringContaining("/api/v1/staff/food-runner-items/101/delivered")
            );
        });
    });

    it("3. Realtime food:delivered event triggers refresh on Server floor plan and pass", async () => {
        render(
            <MemoryRouter>
                <RestaurantContextProvider>
                    <RestaurantThemeProvider>
                        <LanguageProvider>
                            <CartProvider>
                                <Server />
                            </CartProvider>
                        </LanguageProvider>
                    </RestaurantThemeProvider>
                </RestaurantContextProvider>
            </MemoryRouter>
        );

        expect(mockSocketListeners["food:delivered"]).toBeDefined();

        // Simulate incoming food:delivered socket event from backend
        act(() => {
            mockSocketListeners["food:delivered"]({
                itemId: 101,
                tableId: 8,
                tableNo: "1",
                section: "Main Hall",
                status: "SERVED",
            });
        });

        // Verifies that food:delivered calls canonical refresh
        expect(mockRefreshCanonicalReady).toHaveBeenCalled();
    });
});
