import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Server, { normalizeTableKey } from "../pages/Server.jsx";
import { LanguageProvider } from "../context/LanguageContext.jsx";
import { RestaurantThemeProvider } from "../context/ThemeContext.jsx";
import { RestaurantContextProvider } from "../context/RestaurantContext.jsx";
import { CartProvider } from "../context/CartContext.jsx";

const mockRefreshTables = vi.fn();
const mockRefreshLiveOrders = vi.fn();
const mockRefreshReadyKots = vi.fn();
const mockRefreshReservations = vi.fn();

const mockTables = [
    {
        id: 10,
        tableNo: "2",
        seats: 4,
        isOccupied: false,
        assignedWaiterId: null,
        assignedWaiterName: null,
        activeOrders: [],
    },
    {
        id: 20,
        tableNo: "T2",
        seats: 2,
        isOccupied: false,
        assignedWaiterId: null,
        assignedWaiterName: null,
        activeOrders: [],
    },
];

vi.mock("../hooks/useCachedGet", () => ({
    default: (url) => {
        const urlStr = String(url || "");
        if (urlStr.includes("/tables")) {
            return { data: { tables: mockTables }, loading: false, refresh: mockRefreshTables };
        }
        if (urlStr.includes("/menu")) {
            return { data: { items: [] }, loading: false, refresh: vi.fn() };
        }
        if (urlStr.includes("/reservations")) {
            return { data: { reservations: [] }, loading: false, refresh: mockRefreshReservations };
        }
        if (urlStr.includes("/kots")) {
            return { data: { kots: [] }, loading: false, refresh: mockRefreshReadyKots };
        }
        if (urlStr.includes("/orders")) {
            return { data: { orders: [] }, loading: false, refresh: mockRefreshLiveOrders };
        }
        return { data: null, loading: false, refresh: vi.fn() };
    },
}));

vi.mock("axios", () => {
    const mockAxiosInstance = {
        get: vi.fn().mockResolvedValue({ data: { unreadCount: 0, notifications: [] } }),
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
        user: { id: 101, restaurantId: 1, name: "Kamalesh", role: "SERVER" },
        token: "fake-jwt-token",
        logout: vi.fn(),
    }),
}));

const socketListeners = {};
const mockSocket = {
    on: vi.fn((event, callback) => {
        socketListeners[event] = callback;
    }),
    off: vi.fn((event) => {
        delete socketListeners[event];
    }),
    emit: vi.fn(),
};

vi.mock("../context/StaffSocketContext.jsx", () => ({
    useStaffSocket: () => ({
        socket: mockSocket,
        isConnected: true,
    }),
}));

describe("P0 Server Station Real-Time Table Assignment Synchronization", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.keys(socketListeners).forEach((k) => delete socketListeners[k]);
    });

    const renderServer = () =>
        render(
            <MemoryRouter initialEntries={["/server"]}>
                <LanguageProvider>
                    <RestaurantThemeProvider>
                        <RestaurantContextProvider>
                            <CartProvider>
                                <Server />
                            </CartProvider>
                        </RestaurantContextProvider>
                    </RestaurantThemeProvider>
                </LanguageProvider>
            </MemoryRouter>
        );

    it("1. normalizeTableKey does NOT collapse Table 2 and T2 into 2", () => {
        const keyTable2 = normalizeTableKey("Table 2");
        const keyT2 = normalizeTableKey("T2");
        const keyJust2 = normalizeTableKey("2");

        expect(keyTable2).toBe("table 2");
        expect(keyT2).toBe("t2");
        expect(keyJust2).toBe("2");

        // Identity collision immunity
        expect(keyTable2).not.toBe(keyT2);
        expect(keyT2).not.toBe(keyJust2);
        expect(keyTable2).not.toBe(keyJust2);
    });

    it("2. Server Station registers listeners on staff socket for table:waiter_assigned and notification:new", async () => {
        renderServer();

        await waitFor(() => {
            expect(mockSocket.on).toHaveBeenCalledWith("table:waiter_assigned", expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith("table:updated", expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith("notification:new", expect.any(Function));
        });
    });

    it("3. Receiving table:waiter_assigned triggers immediate refreshTables({ force: true })", async () => {
        renderServer();

        await waitFor(() => {
            expect(socketListeners["table:waiter_assigned"]).toBeDefined();
        });

        // Trigger real-time event from Owner table assignment
        act(() => {
            socketListeners["table:waiter_assigned"]({
                tableId: 10,
                tableNo: "2",
                assignedWaiterId: 101,
                assignedWaiterName: "Kamalesh",
                restaurantId: 1,
            });
        });

        expect(mockRefreshTables).toHaveBeenCalledWith({ force: true });
    });

    it("4. Receiving notification:new for TABLE_ASSIGNMENT triggers immediate refreshTables({ force: true })", async () => {
        renderServer();

        await waitFor(() => {
            expect(socketListeners["notification:new"]).toBeDefined();
        });

        act(() => {
            socketListeners["notification:new"]({
                id: 999,
                notificationType: "TABLE_ASSIGNMENT",
                title: "📋 Table Assigned — Table 2",
                message: "Table 2 has been assigned to you. Please check/attend Table 2.",
                recipientId: 101,
                data: {
                    tableId: 10,
                    tableNo: "2",
                    action: "ASSIGNED",
                },
            });
        });

        expect(mockRefreshTables).toHaveBeenCalledWith({ force: true });
    });

    it("5. Receiving notification:new for TABLE_UNASSIGNED triggers immediate refreshTables({ force: true })", async () => {
        renderServer();

        await waitFor(() => {
            expect(socketListeners["notification:new"]).toBeDefined();
        });

        act(() => {
            socketListeners["notification:new"]({
                id: 1000,
                notificationType: "TABLE_UNASSIGNED",
                title: "Table Assigned — Unassigned Table 2",
                message: "You have been unassigned from Table 2.",
                recipientId: 101,
                data: {
                    tableId: 10,
                    tableNo: "2",
                    action: "UNASSIGNED",
                },
            });
        });

        expect(mockRefreshTables).toHaveBeenCalledWith({ force: true });
    });
});
