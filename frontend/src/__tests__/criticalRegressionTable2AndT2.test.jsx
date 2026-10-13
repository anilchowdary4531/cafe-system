import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
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
}));

const mockTables = [
    {
        id: 2,
        tableNo: "T2",
        seats: 4,
        isOccupied: false,
        assignedWaiterId: null,
        assignedWaiterName: null,
        activeOrders: [],
    },
    {
        id: 6,
        tableNo: "2",
        seats: 4,
        isOccupied: false,
        assignedWaiterId: null,
        assignedWaiterName: null,
        activeOrders: [],
    },
];

const mockStaff = [
    {
        id: 101,
        name: "kamalesh",
        role: "WAITER",
        designation: "Server",
        isActive: true,
    },
    {
        id: 102,
        name: "Priya Patel",
        role: "WAITER",
        designation: "Server",
        isActive: true,
    },
];

describe("CRITICAL REGRESSION: Table 2 (id:6) vs Table T2 (id:2) Strict Independence", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        socketListeners = {};

        axios.get.mockImplementation((url) => {
            if (url.includes("/tables")) {
                return Promise.resolve({ data: mockTables });
            }
            if (url.includes("/staff")) {
                return Promise.resolve({ data: { users: mockStaff } });
            }
            if (url.includes("/group-catalogs")) {
                return Promise.resolve({ data: [] });
            }
            if (url.includes("/table-groups")) {
                return Promise.resolve({ data: {} });
            }
            return Promise.resolve({ data: [] });
        });

        axios.post.mockResolvedValue({ data: { ok: true } });
    });

    const renderOwnerPanel = () => {
        return render(
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
    };

    it("1. Complete lifecycle: Assign Table 2 -> Verify T2 unchanged -> Assign T2 -> Verify Table 2 unchanged", async () => {
        renderOwnerPanel();

        await waitFor(() => {
            expect(screen.getByTitle("Assign server for Table 2")).toBeInTheDocument();
            expect(screen.getByTitle("Assign server for Table T2")).toBeInTheDocument();
        });

        // 1. Assign Server A (kamalesh) to Main Hall Table 2
        fireEvent.click(screen.getByTitle("Assign server for Table 2"));
        await waitFor(() => {
            expect(screen.getByText("Assign server for table 2")).toBeInTheDocument();
        });
        fireEvent.click(screen.getByRole("button", { name: "kamalesh" }));

        // Verify API was called with database ID 6 (Table 2's ID)
        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("/tables/6/assign-waiter"),
                expect.objectContaining({ waiterId: 101, waiterName: "kamalesh" })
            );
        });

        // Verify Table 2 displays SV kamalesh
        await waitFor(() => {
            expect(screen.getByTitle("Assigned: kamalesh - Server")).toBeInTheDocument();
        });

        // 2. Verify T2 remains completely unchanged (+ Server)
        expect(screen.getByTitle("Assign server for Table T2")).toBeInTheDocument();

        // 3. Assign Server B (Priya Patel) to T2
        fireEvent.click(screen.getByTitle("Assign server for Table T2"));
        await waitFor(() => {
            expect(screen.getByText("Assign server for table T2")).toBeInTheDocument();
        });
        fireEvent.click(screen.getByRole("button", { name: "Priya Patel" }));

        // Verify API was called with database ID 2 (T2's ID)
        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("/tables/2/assign-waiter"),
                expect.objectContaining({ waiterId: 102, waiterName: "Priya Patel" })
            );
        });

        // Verify T2 displays SV Priya Patel
        await waitFor(() => {
            expect(screen.getByTitle("Assigned: Priya Patel - Server")).toBeInTheDocument();
        });

        // 4. Verify Main Hall Table 2 remains Server A (kamalesh)
        expect(screen.getByTitle("Assigned: kamalesh - Server")).toBeInTheDocument();
    });

    it("2. Refresh: Re-rendering with backend assignments preserves both Table 2 and T2 independently", async () => {
        axios.get.mockImplementation((url) => {
            if (url.includes("/tables")) {
                return Promise.resolve({
                    data: [
                        { ...mockTables[0], assignedWaiterId: 102, assignedWaiterName: "Priya Patel" },
                        { ...mockTables[1], assignedWaiterId: 101, assignedWaiterName: "kamalesh" },
                    ]
                });
            }
            if (url.includes("/staff")) return Promise.resolve({ data: { users: mockStaff } });
            return Promise.resolve({ data: [] });
        });

        renderOwnerPanel();

        await waitFor(() => {
            expect(screen.getByTitle("Assigned: kamalesh - Server")).toBeInTheDocument();
            expect(screen.getByTitle("Assigned: Priya Patel - Server")).toBeInTheDocument();
        });
    });

    it("3. Real-time Socket.IO: Changing Table 2 via socket event updates only Table 2", async () => {
        renderOwnerPanel();

        await waitFor(() => {
            expect(screen.getByTitle("Assign server for Table 2")).toBeInTheDocument();
            expect(screen.getByTitle("Assign server for Table T2")).toBeInTheDocument();
        });

        // Mock backend returning updated Table 2 on reload
        axios.get.mockImplementation((url) => {
            if (url.includes("/tables")) {
                return Promise.resolve({
                    data: [
                        mockTables[0], // T2 remains unassigned
                        { ...mockTables[1], assignedWaiterId: 101, assignedWaiterName: "kamalesh" },
                    ]
                });
            }
            if (url.includes("/staff")) return Promise.resolve({ data: { users: mockStaff } });
            return Promise.resolve({ data: [] });
        });

        // Fire socket event
        expect(socketListeners["table:updated"]).toBeDefined();
        socketListeners["table:updated"]({
            restaurantId: 1,
            tableId: 6,
            tableNo: "2",
            assignedWaiterId: 101,
            assignedWaiterName: "kamalesh"
        });

        await waitFor(() => {
            expect(screen.getByTitle("Assigned: kamalesh - Server")).toBeInTheDocument();
            expect(screen.getByTitle("Assign server for Table T2")).toBeInTheDocument();
        });
    });

    it("4. Drag and Drop: Dropping staff onto Table 2 targets ID 6 and leaves T2 unchanged", async () => {
        renderOwnerPanel();

        await waitFor(() => {
            expect(screen.getByTitle("Assign server for Table 2")).toBeInTheDocument();
            expect(screen.getByTitle("Assign server for Table T2")).toBeInTheDocument();
        });

        const table2Card = screen.getByTitle(/Table 2 - Free/i);
        fireEvent.drop(table2Card, {
            dataTransfer: {
                getData: (type) => (type === "text/plain" ? "101" : ""),
            },
        });

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("/tables/6/assign-waiter"),
                expect.objectContaining({ waiterId: 101, waiterName: "kamalesh" })
            );
        });

        expect(screen.getByTitle("Assign server for Table T2")).toBeInTheDocument();
    });
});
