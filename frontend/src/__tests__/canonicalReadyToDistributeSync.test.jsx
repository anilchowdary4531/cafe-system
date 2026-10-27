import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import Server from "../pages/Server.jsx";
import { LanguageProvider } from "../context/LanguageContext.jsx";
import { RestaurantThemeProvider } from "../context/ThemeContext.jsx";
import { RestaurantContextProvider } from "../context/RestaurantContext.jsx";
import { CartProvider } from "../context/CartContext.jsx";

const mockTables = [
    {
        id: 1,
        tableNo: "T1",
        seats: 4,
        isOccupied: true,
        isBlocked: false,
        section: "Main Hall",
        assignedWaiterId: 101,
        assignedWaiterName: "Waiter Sam",
        activeOrders: [],
    },
];

let mockCanonicalReadyItems = [];
const mockRefreshCanonicalReady = vi.fn();
const mockSocketListeners = {};

vi.mock("../hooks/useCachedGet", () => ({
    default: (url) => {
        const urlStr = String(url || "");
        if (urlStr.includes("/kitchen/ready-items") || urlStr.includes("/ready-items")) {
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

vi.mock("axios", () => {
    const mockAxiosInstance = {
        get: vi.fn(),
        post: vi.fn().mockResolvedValue({ data: { success: true } }),
        put: vi.fn().mockResolvedValue({ data: { success: true } }),
        delete: vi.fn().mockResolvedValue({ data: { success: true } }),
        interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() },
        },
    };
    mockAxiosInstance.create = vi.fn(() => mockAxiosInstance);
    return {
        default: mockAxiosInstance,
        ...mockAxiosInstance,
    };
});

vi.mock("../context/AuthContext.jsx", () => ({
    useAuth: () => ({
        user: { id: 101, restaurantId: 1, name: "Waiter Sam", role: "SERVER" },
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

describe("CANONICAL READY-TO-DISTRIBUTE FRONTEND SYNC SUITE", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCanonicalReadyItems = [];
    });

    it("Criteria A & E: Header count equals queue length when Chef marks 1 item READY", async () => {
        mockCanonicalReadyItems = [
            {
                id: 304,
                kotItemId: 304,
                orderItemId: 201,
                kotId: 101,
                kotNo: "KOT-101",
                orderId: 50,
                orderNo: "ORD-050",
                tableNo: "T1",
                waiterName: "Waiter Sam",
                stationName: "Kitchen",
                itemName: "Margherita Pizza",
                qty: 1,
                notes: "Extra basil",
                readyAt: new Date().toISOString(),
                assignedChefId: 5,
                assignedChefName: "Chef Mario",
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

        // Header shows Ready to Distribute with count 1
        const headerBtn = await screen.findByTitle("Kitchen Pass / Ready to Distribute");
        expect(headerBtn).toBeInTheDocument();
        expect(headerBtn).toHaveTextContent("Ready to Distribute");
        expect(headerBtn).toHaveTextContent("1");

        // Pass / distribution badge shows 1 Item
        expect(screen.getByText("1 Item")).toBeInTheDocument();

        // Queue card displays the exact canonical item
        expect(screen.getByText("Margherita Pizza")).toBeInTheDocument();
        expect(screen.getByText("(Extra basil)")).toBeInTheDocument();
        expect(screen.getByText("#KOT-101")).toBeInTheDocument();
    });

    it("Criteria B: Multiple READY items display exact count in header and match queue length", async () => {
        mockCanonicalReadyItems = [
            {
                id: 304,
                kotItemId: 304,
                orderItemId: 201,
                kotId: 101,
                kotNo: "KOT-101",
                orderId: 50,
                orderNo: "ORD-050",
                tableNo: "T1",
                waiterName: "Waiter Sam",
                stationName: "Kitchen",
                itemName: "Margherita Pizza",
                qty: 1,
                status: "READY",
            },
            {
                id: 305,
                kotItemId: 305,
                orderItemId: 202,
                kotId: 101,
                kotNo: "KOT-101",
                orderId: 50,
                orderNo: "ORD-050",
                tableNo: "T1",
                waiterName: "Waiter Sam",
                stationName: "Bar",
                itemName: "Cold Brew Coffee",
                qty: 2,
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

        // Header shows 2
        const headerBtn = await screen.findByTitle("Kitchen Pass / Ready to Distribute");
        expect(headerBtn).toHaveTextContent("Ready to Distribute");
        expect(headerBtn).toHaveTextContent("2");
        expect(screen.getByText("2 Items")).toBeInTheDocument();

        // Both items rendered in queue
        expect(screen.getByText("Margherita Pizza")).toBeInTheDocument();
        expect(screen.getByText("Cold Brew Coffee")).toBeInTheDocument();
    });

    it("Criteria C: Partial order readiness - 1 item ready from order shows 1 ready item, not 0 and not full order", async () => {
        // Order has Pizza (READY), but Coffee is PREPARING and Burger is PENDING (not in readyItems)
        mockCanonicalReadyItems = [
            {
                id: 304,
                kotItemId: 304,
                orderItemId: 201,
                kotId: 101,
                kotNo: "KOT-101",
                orderId: 50,
                orderNo: "ORD-050",
                tableNo: "T1",
                waiterName: "Waiter Sam",
                stationName: "Kitchen",
                itemName: "Margherita Pizza",
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

        const headerBtn = await screen.findByTitle("Kitchen Pass / Ready to Distribute");
        expect(headerBtn).toHaveTextContent("1");
        expect(screen.getByText("Margherita Pizza")).toBeInTheDocument();
        expect(screen.queryByText("Cold Brew Coffee")).not.toBeInTheDocument();
        expect(screen.queryByText("Burger")).not.toBeInTheDocument();
    });

    it("Criteria D: Distributing an individual item calls canonical status endpoint with SERVED", async () => {
        mockCanonicalReadyItems = [
            {
                id: 304,
                kotItemId: 304,
                orderItemId: 201,
                kotId: 101,
                kotNo: "KOT-101",
                orderId: 50,
                orderNo: "ORD-050",
                tableNo: "T1",
                waiterName: "Waiter Sam",
                stationName: "Kitchen",
                itemName: "Margherita Pizza",
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
            expect(axios.put).toHaveBeenCalledWith(
                expect.stringContaining("/kitchen/items/304/status"),
                { status: "SERVED" }
            );
        });
    });

    it("Criteria F & H: Socket event kitchen:item_ready and reconnect trigger canonical refresh", async () => {
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

        expect(mockSocketListeners["kitchen:item_ready"]).toBeDefined();
        expect(mockSocketListeners["kitchen:item_served"]).toBeDefined();
        expect(mockSocketListeners["connect"]).toBeDefined();

        // Trigger socket event
        mockSocketListeners["kitchen:item_ready"]({
            kotItemId: 304,
            itemName: "Margherita Pizza",
            tableNo: "T1",
        });

        expect(mockRefreshCanonicalReady).toHaveBeenCalledWith({ force: true });

        // Trigger reconnect
        mockSocketListeners["connect"]();
        expect(mockRefreshCanonicalReady).toHaveBeenCalled();
    });
});
