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

vi.mock("../context/StaffSocketContext.jsx", () => ({
    useStaffSocket: () => ({
        socket: {
            on: vi.fn(),
            off: vi.fn(),
            emit: vi.fn(),
        },
        isConnected: true,
    }),
}));

const mockTables = [
    {
        id: 1,
        tableNo: "1",
        seats: 4,
        isOccupied: false,
        assignedWaiterId: null,
        assignedWaiterName: null,
        activeOrders: [],
    },
    {
        id: 2,
        tableNo: "2",
        seats: 4,
        isOccupied: true,
        assignedWaiterId: 101,
        assignedWaiterName: "Rahul Sharma",
        activeOrders: [
            {
                id: 501,
                orderNo: "ORD-501",
                status: "PREPARING",
                total: 350,
                items: [{ id: 1, itemName: "Paneer Tikka", qty: 1, price: 350, total: 350 }],
            },
        ],
        activeSession: {
            id: 99,
            status: "OPEN",
            waiterId: 101,
            waiterName: "Rahul Sharma",
        },
    },
];

const mockStaff = [
    {
        id: 101,
        name: "Rahul Sharma",
        role: "STAFF",
        designation: "Waiter",
        isActive: true,
    },
    {
        id: 102,
        name: "Priya Patel",
        role: "STAFF",
        designation: "Waiter",
        isActive: true,
    },
];

describe("OwnerLayout — Server Assignment, Table Mapping & Display Audit", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();

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

    it("1. Unassigned Table 1 displays '+ Server' option", async () => {
        renderOwnerPanel();

        // Wait for tables to load
        await waitFor(() => {
            expect(screen.getByTitle(/Assign server for Table 1/i)).toBeInTheDocument();
        });

        const addServerBtn = screen.getByTitle(/Assign server for Table 1/i);
        expect(addServerBtn).toHaveTextContent("+ Server");
    });

    it("2. Assigned Table 2 displays server badge with correct server name and replaces '+ Server'", async () => {
        renderOwnerPanel();

        await waitFor(() => {
            // Table 2 is assigned to Rahul Sharma; it should show his badge
            expect(screen.getByTitle(/Assigned: Rahul Sharma/i)).toBeInTheDocument();
        });

        const serverBadge = screen.getByTitle(/Assigned: Rahul Sharma/i);
        expect(serverBadge).toHaveTextContent("Rahul Sharma");

        // '+ Server' must NOT be displayed for Table 2
        expect(screen.queryByTitle(/Assign server for Table 2/i)).not.toBeInTheDocument();
    });

    it("3. Clicking assigned server opens selector with staff options and 'Remove assigned server'", async () => {
        renderOwnerPanel();

        await waitFor(() => {
            expect(screen.getByTitle(/Assigned: Rahul Sharma/i)).toBeInTheDocument();
        });

        const serverBadge = screen.getByTitle(/Assigned: Rahul Sharma/i);
        fireEvent.click(serverBadge);

        // Popover should open showing staff options and remove button
        await waitFor(() => {
            expect(screen.getByText("Remove assigned server")).toBeInTheDocument();
            expect(screen.getByText("Priya Patel")).toBeInTheDocument();
        });
    });

    it("4. Selecting new server (Priya Patel) sends POST assign-waiter request and updates UI", async () => {
        renderOwnerPanel();

        await waitFor(() => {
            expect(screen.getByTitle(/Assign server for Table 1/i)).toBeInTheDocument();
        });

        // Click + Server on Table 1
        const addServerBtn = screen.getByTitle(/Assign server for Table 1/i);
        fireEvent.click(addServerBtn);

        await waitFor(() => {
            expect(screen.getByText("Priya Patel")).toBeInTheDocument();
        });

        // Click Priya Patel
        fireEvent.click(screen.getByText("Priya Patel"));

        // API should be called with table 1 and waiter 102
        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("/tables/1/assign-waiter"),
                expect.objectContaining({ waiterId: 102 })
            );
        });
    });

    it("5. Clicking 'Remove assigned server' sends POST unassign-waiter request", async () => {
        renderOwnerPanel();

        await waitFor(() => {
            expect(screen.getByTitle(/Assigned: Rahul Sharma/i)).toBeInTheDocument();
        });

        const serverBadge = screen.getByTitle(/Assigned: Rahul Sharma/i);
        fireEvent.click(serverBadge);

        await waitFor(() => {
            expect(screen.getByText("Remove assigned server")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText("Remove assigned server"));

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("/tables/2/unassign-waiter"),
                expect.anything()
            );
        });
    });
});
