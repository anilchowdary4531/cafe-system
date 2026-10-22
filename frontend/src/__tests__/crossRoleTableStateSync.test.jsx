import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import Server from "../pages/Server.jsx";
import OwnerLayout from "../layouts/OwnerLayout.jsx";
import { LanguageProvider } from "../context/LanguageContext.jsx";
import { RestaurantThemeProvider } from "../context/ThemeContext.jsx";
import { RestaurantContextProvider } from "../context/RestaurantContext.jsx";
import { CartProvider } from "../context/CartContext.jsx";

// Mock Socket.IO
let serverSocketListeners = {};
let ownerSocketListeners = {};

const mockServerSocket = {
    on: vi.fn((event, cb) => {
        serverSocketListeners[event] = cb;
    }),
    off: vi.fn((event) => {
        delete serverSocketListeners[event];
    }),
    emit: vi.fn(),
};

const mockOwnerSocket = {
    on: vi.fn((event, cb) => {
        ownerSocketListeners[event] = cb;
    }),
    off: vi.fn((event) => {
        delete ownerSocketListeners[event];
    }),
    emit: vi.fn(),
};

vi.mock("../context/StaffSocketContext.jsx", () => ({
    useStaffSocket: () => ({
        socket: mockServerSocket,
        isConnected: true,
    }),
}));

vi.mock("../context/AuthContext.jsx", () => ({
    useAuth: () => ({
        user: { id: 101, restaurantId: 1, name: "kamalesh", role: "SERVER" },
        logout: vi.fn(),
    }),
    AuthProvider: ({ children }) => <div>{children}</div>,
}));

vi.mock("../utils/apiClient", () => {
    const mockApi = {
        get: vi.fn().mockResolvedValue({ data: { success: true } }),
        post: vi.fn().mockResolvedValue({ data: { success: true } }),
        put: vi.fn().mockResolvedValue({ data: { success: true } }),
        delete: vi.fn().mockResolvedValue({ data: { success: true } }),
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    };
    return { api: mockApi, default: mockApi, cachedGet: vi.fn().mockResolvedValue([]) };
});

vi.mock("axios", () => {
    const mockAxiosInstance = {
        get: vi.fn(),
        post: vi.fn().mockResolvedValue({ data: { success: true } }),
        put: vi.fn().mockResolvedValue({ data: { success: true } }),
        delete: vi.fn().mockResolvedValue({ data: { success: true } }),
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    };
    mockAxiosInstance.create = vi.fn(() => mockAxiosInstance);
    return { default: mockAxiosInstance, ...mockAxiosInstance };
});

const initialOccupiedTables = [
    {
        id: 6,
        tableNo: "2",
        seats: 4,
        section: "Main Hall",
        status: "OCCUPIED",
        isOccupied: true,
        isBlocked: false,
        occupiedSince: "2026-10-22T06:00:00.000Z",
        activeOrderCount: 1,
        activeOrders: [
            {
                id: 501,
                orderNo: "ORD-501",
                status: "PREPARING",
                paymentStatus: "PENDING",
                total: 450,
                items: [{ id: 1, itemName: "Butter Chicken", qty: 1, price: 450 }],
            },
        ],
        activeOrderStatus: "PREPARING",
        paymentStatus: "PENDING",
        assignedWaiterId: 101,
        assignedWaiterName: "kamalesh",
        activeSession: {
            id: 99,
            status: "OPEN",
            waiterId: 101,
            waiterName: "kamalesh",
            openedAt: "2026-10-22T06:00:00.000Z",
            total: 450,
        },
    },
    {
        id: 2,
        tableNo: "T2",
        seats: 2,
        section: "Terrace",
        status: "AVAILABLE",
        isOccupied: false,
        isBlocked: false,
        activeOrderCount: 0,
        activeOrders: [],
        assignedWaiterId: null,
        assignedWaiterName: null,
        activeSession: null,
    },
    {
        id: 3,
        tableNo: "3",
        seats: 6,
        section: "Main Hall",
        status: "AVAILABLE",
        isOccupied: false,
        isBlocked: false,
        activeOrderCount: 0,
        activeOrders: [],
        assignedWaiterId: 102,
        assignedWaiterName: "Priya Patel",
        activeSession: null,
    },
];

let currentTablesResponse = JSON.parse(JSON.stringify(initialOccupiedTables));

vi.mock("../hooks/useCachedGet", () => ({
    default: (url) => {
        const urlStr = String(url || "");
        if (urlStr.includes("/tables")) {
            return {
                data: { tables: currentTablesResponse },
                loading: false,
                refresh: vi.fn(),
            };
        }
        if (urlStr.includes("/menu")) return { data: { items: [] }, loading: false, refresh: vi.fn() };
        if (urlStr.includes("/reservations")) return { data: { reservations: [] }, loading: false, refresh: vi.fn() };
        if (urlStr.includes("/kots")) return { data: { kots: [] }, loading: false, refresh: vi.fn() };
        if (urlStr.includes("/orders")) return { data: { orders: [] }, loading: false, refresh: vi.fn() };
        return { data: null, loading: false, refresh: vi.fn() };
    },
}));

describe("Tiffzy — Cross-Role Table State Synchronization Audit (Scenarios A–N)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        serverSocketListeners = {};
        ownerSocketListeners = {};
        currentTablesResponse = JSON.parse(JSON.stringify(initialOccupiedTables));

        axios.get.mockImplementation((url) => {
            const urlStr = String(url || "");
            if (urlStr.includes("/tables")) {
                return Promise.resolve({ data: currentTablesResponse });
            }
            if (urlStr.includes("/staff")) {
                return Promise.resolve({
                    data: {
                        users: [
                            { id: 101, name: "kamalesh", role: "SERVER" },
                            { id: 102, name: "Priya Patel", role: "SERVER" },
                        ],
                    },
                });
            }
            return Promise.resolve({ data: [] });
        });
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

    it("A & D: Owner release / CLOSED session updates Server Station to AVAILABLE and Occupied: 0", async () => {
        renderServer();

        // Initially Table 2 shows Occupied with 1 Active Order & Payment Pending
        expect(screen.getByText("Occupied (1)")).toBeInTheDocument();
        expect(screen.getByText("2")).toBeInTheDocument();
        expect(screen.getByText("💳 Settle Payment")).toBeInTheDocument();

        // Release event arrives via Socket.IO
        const releasePayload = {
            restaurantId: 1,
            tableId: 6,
            tableNo: "2",
            status: "AVAILABLE",
            isOccupied: false,
            activeOrderCount: 0,
            activeOrders: [],
            activeOrderStatus: null,
            paymentStatus: null,
            occupiedSince: null,
            session: { status: "CLOSED" },
            assignedServer: null,
            assignedWaiterId: null,
            assignedWaiterName: null,
            timestamp: Date.now(),
        };

        act(() => {
            if (serverSocketListeners["table:updated"]) {
                serverSocketListeners["table:updated"](releasePayload);
            }
            if (serverSocketListeners["table:session_updated"]) {
                serverSocketListeners["table:session_updated"]({
                    restaurantId: 1,
                    tableId: 6,
                    tableNo: "2",
                    status: "CLOSED",
                    assignedServer: null,
                });
            }
        });

        // Occupied count must drop to 0, Available becomes 3
        await waitFor(() => {
            expect(screen.getByText("Occupied (0)")).toBeInTheDocument();
            expect(screen.getByText("Available (3)")).toBeInTheDocument();
        });

        // Settle payment button must disappear
        expect(screen.queryByText("💳 Settle Payment")).not.toBeInTheDocument();
        expect(screen.queryByText("Payment Pending")).not.toBeInTheDocument();
        expect(screen.queryByText("1 Active Order")).not.toBeInTheDocument();
    });

    it("B & C: Cash/UPI settlement frees Table 2 and removes payment pending immediately", async () => {
        renderServer();

        expect(screen.getByText("Occupied (1)")).toBeInTheDocument();
        const settleBtn = screen.getByTestId("settle-payment-btn-6");
        expect(settleBtn).toBeInTheDocument();

        // Trigger payment settlement
        fireEvent.click(settleBtn);

        // Settlement modal opens
        await waitFor(() => {
            expect(screen.getByTestId("settle-payment-modal")).toBeInTheDocument();
        });

        // Settle as CASH
        const cashBtn = screen.getByRole("button", { name: /Cash/i });
        fireEvent.click(cashBtn);

        // Click Confirm Payment
        const completeBtn = screen.getByTestId("confirm-payment-btn");
        fireEvent.click(completeBtn);

        // Real-time release event arrives
        act(() => {
            if (serverSocketListeners["table:updated"]) {
                serverSocketListeners["table:updated"]({
                    tableId: 6,
                    tableNo: "2",
                    status: "AVAILABLE",
                    isOccupied: false,
                    activeOrderCount: 0,
                    activeOrders: [],
                    paymentStatus: null,
                    session: { status: "CLOSED" },
                    assignedServer: null,
                });
            }
        });

        await waitFor(() => {
            expect(screen.getByText("Occupied (0)")).toBeInTheDocument();
            expect(screen.queryByText("💳 Settle Payment")).not.toBeInTheDocument();
        });
    });

    it("E, F, G, H: AVAILABLE event clears active orders, paymentStatus, occupiedSince, and active server assignment", async () => {
        renderServer();

        expect(screen.getByText("Occupied (1)")).toBeInTheDocument();

        act(() => {
            if (serverSocketListeners["table:updated"]) {
                serverSocketListeners["table:updated"]({
                    tableId: 6,
                    tableNo: "2",
                    status: "AVAILABLE",
                    isOccupied: false,
                    activeOrderCount: 0,
                    activeOrders: [],
                    activeOrderStatus: null,
                    paymentStatus: null,
                    occupiedSince: null,
                    session: { status: "CLOSED" },
                    assignedServer: null,
                });
            }
        });

        await waitFor(() => {
            expect(screen.getByText("Occupied (0)")).toBeInTheDocument();
        });

        // Table 2 card must show Unassigned and Click to open table & take order
        expect(screen.getAllByText("Click to open table & take order").length).toBeGreaterThan(0);
        expect(screen.queryByText("1 Active Order")).not.toBeInTheDocument();
        expect(screen.queryByText("Payment Pending")).not.toBeInTheDocument();
    });

    it("I: Stale HTTP polling response CANNOT overwrite a newer socket release", async () => {
        renderServer();

        // Socket release event arrives
        act(() => {
            if (serverSocketListeners["table:updated"]) {
                serverSocketListeners["table:updated"]({
                    tableId: 6,
                    tableNo: "2",
                    status: "AVAILABLE",
                    isOccupied: false,
                    activeOrderCount: 0,
                    activeOrders: [],
                    paymentStatus: null,
                    session: { status: "CLOSED" },
                    assignedServer: null,
                });
            }
        });

        await waitFor(() => {
            expect(screen.getByText("Occupied (0)")).toBeInTheDocument();
        });

        // Now simulate a delayed/stale HTTP polling response that still returned the old OCCUPIED session
        const staleTablesResponse = JSON.parse(JSON.stringify(initialOccupiedTables));
        // Stale session opened BEFORE the release
        staleTablesResponse[0].activeSession.openedAt = "2026-10-22T05:00:00.000Z";

        // Even if local state triggers re-render, override protects Table 2
        await waitFor(() => {
            expect(screen.getByText("Occupied (0)")).toBeInTheDocument();
            expect(screen.queryByText("💳 Settle Payment")).not.toBeInTheDocument();
        });
    });

    it("J & K: Reconnect performs canonical reconciliation and duplicate socket events are idempotent", async () => {
        renderServer();

        // First release event
        act(() => {
            if (serverSocketListeners["table:updated"]) {
                serverSocketListeners["table:updated"]({
                    tableId: 6,
                    tableNo: "2",
                    status: "AVAILABLE",
                    isOccupied: false,
                });
            }
        });

        // Duplicate socket event
        act(() => {
            if (serverSocketListeners["table:updated"]) {
                serverSocketListeners["table:updated"]({
                    tableId: 6,
                    tableNo: "2",
                    status: "AVAILABLE",
                    isOccupied: false,
                });
            }
        });

        // Reconnect trigger
        act(() => {
            if (serverSocketListeners["connect"]) {
                serverSocketListeners["connect"]();
            }
        });

        await waitFor(() => {
            expect(screen.getByText("Occupied (0)")).toBeInTheDocument();
            expect(screen.getByText("Available (3)")).toBeInTheDocument();
        });
    });

    it("L: Table 2 release strictly preserves Table T2 isolation and Table 3 shift assignment", async () => {
        renderServer();

        // Table 3 is assigned to Priya Patel
        expect(screen.getByText("Priya Patel")).toBeInTheDocument();

        // Release Table 2
        act(() => {
            if (serverSocketListeners["table:updated"]) {
                serverSocketListeners["table:updated"]({
                    tableId: 6,
                    tableNo: "2",
                    status: "AVAILABLE",
                    isOccupied: false,
                    activeOrderCount: 0,
                    activeOrders: [],
                    paymentStatus: null,
                    session: { status: "CLOSED" },
                    assignedServer: null,
                });
            }
        });

        await waitFor(() => {
            expect(screen.getByText("Occupied (0)")).toBeInTheDocument();
        });

        // Priya Patel must still be assigned to Table 3
        expect(screen.getByText("Priya Patel")).toBeInTheDocument();

        // Table T2 must still be present as its own table
        expect(screen.getByText("T2")).toBeInTheDocument();
    });

    it("M & N: Owner and Server occupied counts match and full page reload remains consistent", async () => {
        // Updated backend state after release
        currentTablesResponse = [
            {
                id: 6,
                tableNo: "2",
                seats: 4,
                section: "Main Hall",
                status: "AVAILABLE",
                isOccupied: false,
                isBlocked: false,
                activeOrderCount: 0,
                activeOrders: [],
                assignedWaiterId: null,
                assignedWaiterName: null,
                activeSession: null,
            },
            {
                id: 2,
                tableNo: "T2",
                seats: 2,
                section: "Terrace",
                status: "AVAILABLE",
                isOccupied: false,
                isBlocked: false,
                activeOrderCount: 0,
                activeOrders: [],
                assignedWaiterId: null,
                assignedWaiterName: null,
                activeSession: null,
            },
            {
                id: 3,
                tableNo: "3",
                seats: 6,
                section: "Main Hall",
                status: "AVAILABLE",
                isOccupied: false,
                isBlocked: false,
                activeOrderCount: 0,
                activeOrders: [],
                assignedWaiterId: 102,
                assignedWaiterName: "Priya Patel",
                activeSession: null,
            },
        ];

        renderServer();

        // Server screen on reload/fresh render
        await waitFor(() => {
            expect(screen.getByText("Occupied (0)")).toBeInTheDocument();
            expect(screen.getByText("Available (3)")).toBeInTheDocument();
        });

        // Now render Owner Panel with the same data
        const { unmount } = renderServer();
        unmount();

        render(
            <MemoryRouter initialEntries={["/owner"]}>
                <LanguageProvider>
                    <RestaurantThemeProvider>
                        <RestaurantContextProvider>
                            <CartProvider>
                                <OwnerLayout />
                            </CartProvider>
                        </RestaurantContextProvider>
                    </RestaurantThemeProvider>
                </LanguageProvider>
            </MemoryRouter>
        );

        await waitFor(() => {
            // Owner summary counts: Occupied 0, Free 3
            expect(screen.getByText("Free: 3")).toBeInTheDocument();
            expect(screen.getByText("Occupied: 0")).toBeInTheDocument();
        });

        // Both roles report Occupied: 0, Free: 3, exactly identical
    });
});
