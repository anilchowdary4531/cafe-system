import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import OwnerLayout from "../layouts/OwnerLayout.jsx";
import { LanguageProvider } from "../context/LanguageContext.jsx";
import { RestaurantThemeProvider } from "../context/ThemeContext.jsx";
import { RestaurantContextProvider } from "../context/RestaurantContext.jsx";
import { CartProvider } from "../context/CartContext.jsx";

vi.mock("../utils/apiClient", () => {
    const mockApi = {
        get: vi.fn().mockResolvedValue({ data: {} }),
        post: vi.fn().mockResolvedValue({ data: {} }),
        put: vi.fn().mockResolvedValue({ data: {} }),
        delete: vi.fn().mockResolvedValue({ data: {} }),
        interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() },
        },
    };
    return {
        api: mockApi,
        default: mockApi,
        cachedGet: vi.fn().mockResolvedValue([]),
    };
});

vi.mock("axios", () => {
    const mockAxiosInstance = {
        get: vi.fn().mockResolvedValue({ data: [] }),
        post: vi.fn().mockResolvedValue({ data: {} }),
        put: vi.fn().mockResolvedValue({ data: {} }),
        delete: vi.fn().mockResolvedValue({ data: {} }),
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
        user: { id: 1, restaurantId: 1, name: "Owner Test", role: "OWNER" },
        logout: vi.fn(),
    }),
    AuthProvider: ({ children }) => <div>{children}</div>,
}));

let socketListeners = {};
const mockSocket = {
    on: vi.fn((event, handler) => {
        socketListeners[event] = handler;
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
    StaffSocketProvider: ({ children }) => <div>{children}</div>,
}));

describe("Cash Settlement → Table Release State Sync", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        socketListeners = {};
    });

    const renderOwnerPanel = () =>
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

    it("1. Delivered + unpaid order shows Payment Pending on Table 4 card", async () => {
        const table4Occupied = [
            {
                id: 4,
                tableNo: "4",
                isOccupied: true,
                seats: 4,
                activeOrderCount: 1,
                activeOrders: [
                    {
                        id: 401,
                        orderNo: "ORD-401",
                        status: "DELIVERED",
                        paymentStatus: "PENDING",
                        total: 450,
                    },
                ],
            },
        ];

        axios.get.mockImplementation((url) => {
            if (url.includes("/tables")) return Promise.resolve({ data: table4Occupied });
            if (url.includes("/staff")) return Promise.resolve({ data: [] });
            return Promise.resolve({ data: [] });
        });

        renderOwnerPanel();

        await waitFor(() => {
            // Legend has 1, Table 4 card badge has 1 -> Total 2
            const matches = screen.getAllByText("Payment Pending");
            expect(matches.length).toBeGreaterThanOrEqual(2);
        });
    });

    it("2. Delivered + paid order does NOT show Payment Pending badge on Table 4 card", async () => {
        const table4Paid = [
            {
                id: 4,
                tableNo: "4",
                isOccupied: false,
                seats: 4,
                activeOrderCount: 0,
                activeOrders: [
                    {
                        id: 401,
                        orderNo: "ORD-401",
                        status: "DELIVERED",
                        paymentStatus: "PAID",
                        total: 450,
                    },
                ],
            },
        ];

        axios.get.mockImplementation((url) => {
            if (url.includes("/tables")) return Promise.resolve({ data: table4Paid });
            if (url.includes("/staff")) return Promise.resolve({ data: [] });
            return Promise.resolve({ data: [] });
        });

        renderOwnerPanel();

        await waitFor(() => {
            // Only the legend has "Payment Pending" -> exactly 1
            const matches = screen.getAllByText("Payment Pending");
            expect(matches.length).toBe(1);
            expect(screen.getByText(/Available/i)).toBeInTheDocument();
        });
    });

    it("3. Socket listeners include order:updated, order:status_updated, payment:updated", async () => {
        axios.get.mockResolvedValue({ data: [] });

        renderOwnerPanel();

        await waitFor(() => {
            expect(mockSocket.on).toHaveBeenCalledWith("order:updated", expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith("order:status_updated", expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith("payment:updated", expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith("table:updated", expect.any(Function));
        });
    });
});
