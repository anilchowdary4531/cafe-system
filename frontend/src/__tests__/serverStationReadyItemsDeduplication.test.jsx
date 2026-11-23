import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Server, { isGenuineFoodItem } from "../pages/Server.jsx";
import { LanguageProvider } from "../context/LanguageContext.jsx";
import { RestaurantThemeProvider } from "../context/ThemeContext.jsx";
import { RestaurantContextProvider } from "../context/RestaurantContext.jsx";
import { CartProvider } from "../context/CartContext.jsx";
import { api } from "../utils/apiClient.js";

const mockTables = [
    {
        id: 3,
        tableNo: "T3",
        seats: 4,
        isOccupied: true,
        isBlocked: false,
        section: "Main Hall",
        assignedWaiterId: 101,
        assignedWaiterName: "Server Sam",
        activeOrders: [],
    },
];

const SIX_CAFE_KING_ORDERED_ITEMS = [
    {
        id: 555,
        kotItemId: 555,
        orderItemId: 601,
        kotId: 423,
        kotNo: "457",
        orderId: 426,
        orderNo: "CK-202611230444-T3-1303",
        tableId: 3,
        tableNo: "T3",
        itemName: "Cold Coffee",
        qty: 1,
        status: "READY",
        restaurantId: 1,
    },
    {
        id: 556,
        kotItemId: 556,
        orderItemId: 602,
        kotId: 423,
        kotNo: "457",
        orderId: 426,
        orderNo: "CK-202611230444-T3-1303",
        tableId: 3,
        tableNo: "T3",
        itemName: "Dal Kichidi",
        qty: 1,
        status: "READY",
        restaurantId: 1,
    },
    {
        id: 557,
        kotItemId: 557,
        orderItemId: 603,
        kotId: 423,
        kotNo: "457",
        orderId: 426,
        orderNo: "CK-202611230444-T3-1303",
        tableId: 3,
        tableNo: "T3",
        itemName: "Match Cream Puff",
        qty: 1,
        status: "READY",
        restaurantId: 1,
    },
    {
        id: 558,
        kotItemId: 558,
        orderItemId: 604,
        kotId: 423,
        kotNo: "457",
        orderId: 426,
        orderNo: "CK-202611230444-T3-1303",
        tableId: 3,
        tableNo: "T3",
        itemName: "Gobi Machurian",
        qty: 1,
        status: "READY",
        restaurantId: 1,
    },
    {
        id: 559,
        kotItemId: 559,
        orderItemId: 605,
        kotId: 423,
        kotNo: "457",
        orderId: 426,
        orderNo: "CK-202611230444-T3-1303",
        tableId: 3,
        tableNo: "T3",
        itemName: "Marlboro Advance Compact",
        qty: 1,
        status: "READY",
        restaurantId: 1,
    },
    {
        id: 560,
        kotItemId: 560,
        orderItemId: 606,
        kotId: 423,
        kotNo: "457",
        orderId: 426,
        orderNo: "CK-202611230444-T3-1303",
        tableId: 3,
        tableNo: "T3",
        itemName: "Classic Connect",
        qty: 1,
        status: "READY",
        restaurantId: 1,
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
        user: { id: 101, restaurantId: 1, name: "Server Sam", role: "SERVER" },
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

const renderServer = () =>
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

describe("SERVER STATION READY ITEMS DEDUPLICATION & PHANTOM RECORD PREVENTION SUITE", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCanonicalReadyItems = [];
    });

    it("1. isGenuineFoodItem helper accurately filters out Order, KOT, and name-less objects", () => {
        // Genuine KOT items
        expect(isGenuineFoodItem({ id: 555, kotItemId: 555, itemName: "Cold Coffee", status: "READY" })).toBe(true);
        expect(isGenuineFoodItem({ id: 556, name: "Dal Kichidi", status: "READY" })).toBe(true);

        // Parent Order entity (ID 426) must NOT be recognized as a food item
        expect(isGenuineFoodItem({ id: 426, orderNo: "CK-202611230444-T3-1303", status: "READY", items: [] })).toBe(false);
        expect(isGenuineFoodItem({ id: 426, orderNo: "CK-202611230444-T3-1303", status: "READY" })).toBe(false);

        // Parent KOT entity (ID 423) must NOT be recognized as a food item
        expect(isGenuineFoodItem({ id: 423, kotNo: "457", status: "READY", items: [] })).toBe(false);
        expect(isGenuineFoodItem({ id: 423, kotNo: "457", status: "READY" })).toBe(false);

        // Entity with missing or empty name must NOT be recognized as a food item
        expect(isGenuineFoodItem({ id: 426, status: "READY" })).toBe(false);
        expect(isGenuineFoodItem({ id: 423, status: "READY", itemName: "" })).toBe(false);
        expect(isGenuineFoodItem(null)).toBe(false);
        expect(isGenuineFoodItem(undefined)).toBe(false);
    });

    it("2. Production Incident Reproduction: 6 ordered items produce EXACTLY 6 distribution cards, never 8", async () => {
        mockCanonicalReadyItems = [...SIX_CAFE_KING_ORDERED_ITEMS];

        renderServer();

        // Header shows exact count 6
        const headerBtn = await screen.findByTestId("server-ready-distribute-nav-btn");
        expect(headerBtn).toHaveTextContent("6");
        expect(screen.getByText("6 Ready Item(s)")).toBeInTheDocument();

        // Exactly the 6 genuine items are displayed
        expect(screen.getByText("Cold Coffee")).toBeInTheDocument();
        expect(screen.getByText("Dal Kichidi")).toBeInTheDocument();
        expect(screen.getByText("Match Cream Puff")).toBeInTheDocument();
        expect(screen.getByText("Gobi Machurian")).toBeInTheDocument();
        expect(screen.getByText("Marlboro Advance Compact")).toBeInTheDocument();
        expect(screen.getByText("Classic Connect")).toBeInTheDocument();

        // Phantom Item #426 and Item #423 MUST NOT exist
        expect(screen.queryByText("Item #426")).not.toBeInTheDocument();
        expect(screen.queryByText("Item #423")).not.toBeInTheDocument();
    });

    it("3. Stale Socket.IO order:updated and kot:status_updated events do NOT inject phantom cards #426 and #423", async () => {
        mockCanonicalReadyItems = [...SIX_CAFE_KING_ORDERED_ITEMS];

        renderServer();

        expect(screen.getByText("6 Ready Item(s)")).toBeInTheDocument();

        // Simulate incoming kot:status_updated event with KOT ID 423
        act(() => {
            mockSocketListeners["kot:status_updated"]?.({
                id: 423,
                kotNo: "457",
                orderId: 426,
                tableNo: "T3",
                status: "READY",
                restaurantId: 1,
            });
        });

        // Simulate incoming order:updated event with Order ID 426
        act(() => {
            mockSocketListeners["order:updated"]?.({
                id: 426,
                orderNo: "CK-202611230444-T3-1303",
                tableNo: "T3",
                status: "READY",
                restaurantId: 1,
            });
        });

        // Count MUST REMAIN exactly 6, NOT increase to 8!
        const headerBtn = await screen.findByTestId("server-ready-distribute-nav-btn");
        expect(headerBtn).toHaveTextContent("6");
        expect(screen.getByText("6 Ready Item(s)")).toBeInTheDocument();

        expect(screen.queryByText("Item #426")).not.toBeInTheDocument();
        expect(screen.queryByText("Item #423")).not.toBeInTheDocument();
    });

    it("4. Duplicate Socket.IO events for existing items do NOT create duplicate cards", async () => {
        mockCanonicalReadyItems = [...SIX_CAFE_KING_ORDERED_ITEMS];

        renderServer();

        // Repeatedly emit kitchen:item_ready for Cold Coffee (#555) 5 times
        act(() => {
            for (let i = 0; i < 5; i++) {
                mockSocketListeners["kitchen:item_ready"]?.({
                    kotItemId: 555,
                    id: 555,
                    itemName: "Cold Coffee",
                    tableNo: "T3",
                    status: "READY",
                    restaurantId: 1,
                });
            }
        });

        // Count MUST still remain exactly 6
        const headerBtn = screen.getByTestId("server-ready-distribute-nav-btn");
        expect(headerBtn).toHaveTextContent("6");
        expect(screen.getByText("6 Ready Item(s)")).toBeInTheDocument();

        // Cold Coffee should appear exactly once
        const coldCoffeeCards = screen.getAllByText("Cold Coffee");
        expect(coldCoffeeCards).toHaveLength(1);
    });

    it("5. Delivering 1 item removes only that item and preserves remaining 5 items (partial delivery)", async () => {
        mockCanonicalReadyItems = [...SIX_CAFE_KING_ORDERED_ITEMS];

        renderServer();

        expect(screen.getByText("6 Ready Item(s)")).toBeInTheDocument();

        // Deliver item 555 (Cold Coffee)
        const serveButtons = screen.getAllByRole("button", { name: /Served \/ Distributed/i });
        fireEvent.click(serveButtons[0]);

        // API must be called with canonical KOTItem ID 555
        await waitFor(() => {
            expect(api.put).toHaveBeenCalledWith(
                expect.stringContaining("/api/v1/staff/food-runner-items/555/delivered")
            );
        });

        // Queue must immediately drop to 5 items
        expect(screen.getByText("5 Ready Item(s)")).toBeInTheDocument();
        expect(screen.queryByText("Cold Coffee")).not.toBeInTheDocument();

        // The remaining 5 items must be preserved
        expect(screen.getByText("Dal Kichidi")).toBeInTheDocument();
        expect(screen.getByText("Match Cream Puff")).toBeInTheDocument();
        expect(screen.getByText("Gobi Machurian")).toBeInTheDocument();
        expect(screen.getByText("Marlboro Advance Compact")).toBeInTheDocument();
        expect(screen.getByText("Classic Connect")).toBeInTheDocument();
    });

    it("6. Realtime food:delivered event removes the delivered item immediately", async () => {
        mockCanonicalReadyItems = [...SIX_CAFE_KING_ORDERED_ITEMS];

        renderServer();

        expect(screen.getByText("6 Ready Item(s)")).toBeInTheDocument();

        // Simulate backend emitting food:delivered for item 556 (Dal Kichidi)
        act(() => {
            mockSocketListeners["food:delivered"]?.({
                itemId: 556,
                tableId: 3,
                tableNo: "T3",
                status: "SERVED",
                restaurantId: 1,
            });
        });

        // Item 556 is removed, 5 items remain
        expect(screen.getByText("5 Ready Item(s)")).toBeInTheDocument();
        expect(screen.queryByText("Dal Kichidi")).not.toBeInTheDocument();
        expect(screen.getByText("Cold Coffee")).toBeInTheDocument();
    });

    it("7. Restaurant Tenant Isolation: Events from other restaurants (restaurantId: 999) are ignored", async () => {
        mockCanonicalReadyItems = [...SIX_CAFE_KING_ORDERED_ITEMS];

        renderServer();

        expect(screen.getByText("6 Ready Item(s)")).toBeInTheDocument();

        // Socket event arrives for another restaurant (restaurantId: 999)
        act(() => {
            mockSocketListeners["kitchen:item_ready"]?.({
                kotItemId: 9999,
                id: 9999,
                itemName: "Alien Burger",
                tableNo: "T99",
                status: "READY",
                restaurantId: 999,
            });
        });

        // Alien Burger must NOT appear in Cafe King (restaurantId: 1)
        expect(screen.queryByText("Alien Burger")).not.toBeInTheDocument();
        expect(screen.getByText("6 Ready Item(s)")).toBeInTheDocument();
    });
});
