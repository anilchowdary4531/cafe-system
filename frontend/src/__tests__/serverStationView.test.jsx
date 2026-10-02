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
        tableNo: "1",
        seats: 2,
        isOccupied: false,
        isBlocked: false,
        section: "Patio",
        assignedWaiterId: null,
        assignedWaiterName: null,
        activeOrders: [],
    },
    {
        id: 2,
        tableNo: "2",
        seats: 4,
        isOccupied: true,
        isBlocked: false,
        section: "Main Hall",
        assignedWaiterId: 101,
        assignedWaiterName: "Rahul Sharma",
        activeOrderCount: 1,
        activeOrders: [
            {
                id: 501,
                orderNo: "ORD-501",
                status: "PREPARING",
                total: 350,
                items: [{ id: 1, itemName: "Paneer Tikka", qty: 1, price: 350 }],
            },
        ],
        activeSession: {
            id: 99,
            status: "OPEN",
            waiterId: 101,
            waiterName: "Rahul Sharma",
        },
    },
    {
        id: 3,
        tableNo: "3",
        seats: 6,
        isOccupied: false,
        isBlocked: false,
        section: "Main Hall",
        assignedWaiterId: 102,
        assignedWaiterName: "Priya Patel",
        activeOrders: [],
    },
];

const mockMenuItems = [
    { id: 1, name: "Cold Brew", price: 150, category: "Coffee" },
    { id: 2, name: "Margherita Pizza", price: 320, category: "Pizza" },
];

const mockKots = [
    {
        id: 701,
        kotNo: "KOT-701",
        status: "READY",
        tableNo: "2",
        orderId: 501,
        waiterName: "Rahul Sharma",
        stationName: "Kitchen",
        items: [
            { id: 10, itemName: "Paneer Tikka", qty: 2, status: "READY", notes: "Extra mint sauce" },
        ],
    },
];

vi.mock("../hooks/useCachedGet", () => ({
    default: (url) => {
        const urlStr = String(url || "");
        if (urlStr.includes("/tables")) {
            return { data: { tables: mockTables }, loading: false, refresh: vi.fn() };
        }
        if (urlStr.includes("/menu")) {
            return { data: { items: mockMenuItems }, loading: false, refresh: vi.fn() };
        }
        if (urlStr.includes("/reservations")) {
            return { data: { reservations: [] }, loading: false, refresh: vi.fn() };
        }
        if (urlStr.includes("/kots")) {
            return { data: { kots: mockKots }, loading: false, refresh: vi.fn() };
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
        user: { id: 1, restaurantId: 1, name: "Staff Member", role: "SERVER" },
        logout: vi.fn(),
    }),
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

describe("Server Station — Server Assignment & Table Management Audit", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderServerStation = (initialEntry = "/server") =>
        render(
            <MemoryRouter initialEntries={[initialEntry]}>
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

    it("1. Floor Plan shows assigned waiter for occupied (Table 2) and available (Table 3) tables", async () => {
        renderServerStation("/server");

        // Table 2 is occupied and assigned to Rahul Sharma (appears on table card and kitchen pass ticket)
        expect(screen.getAllByText("Rahul Sharma").length).toBeGreaterThanOrEqual(1);

        // Table 3 is available and assigned to Priya Patel
        expect(screen.getByText("Priya Patel")).toBeInTheDocument();

        // Table 1 is unassigned
        expect(screen.getByText("Unassigned")).toBeInTheDocument();
    });

    it("2. Navigating to /server?table=2 automatically enters ORDERING view for Table 2 and displays assigned server", async () => {
        renderServerStation("/server?table=2");

        await waitFor(() => {
            expect(screen.getByText(/Ordering for Table 2/i)).toBeInTheDocument();
        });

        // Header must show assigned server badge
        expect(screen.getAllByText(/Assigned Server:/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText("Rahul Sharma").length).toBeGreaterThan(0);
    });

    it("3. Ordering view cart header displays assigned server information", async () => {
        renderServerStation("/server?table=2");

        await waitFor(() => {
            expect(screen.getByText(/Table 2 Cart/i)).toBeInTheDocument();
        });

        // Cart header shows Assigned Server: Rahul Sharma
        const cartHeader = screen.getByText(/Table 2 Cart/i).closest(".border-b");
        expect(cartHeader).toHaveTextContent("Rahul Sharma");
    });

    it("4. Adding item to cart and sending KOT sends assigned waiter details", async () => {
        renderServerStation("/server?table=2");

        await waitFor(() => {
            expect(screen.getByText(/Ordering for Table 2/i)).toBeInTheDocument();
        });

        // Click '+ Add' on Cold Brew
        const addButtons = screen.getAllByText("+ Add");
        fireEvent.click(addButtons[0]);

        // Click Send KOT to Kitchen
        const sendKotBtn = screen.getByRole("button", { name: /Send KOT to Kitchen/i });
        fireEvent.click(sendKotBtn);

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("/orders"),
                expect.objectContaining({
                    tableNo: "2",
                    waiterId: 101,
                    waiterName: "Rahul Sharma",
                })
            );
        });
    });

    it("5. Clicking '← Floor Plan' returns to floor plan view", async () => {
        renderServerStation("/server?table=2");

        await waitFor(() => {
            expect(screen.getByText(/Ordering for Table 2/i)).toBeInTheDocument();
        });

        const backBtn = screen.getByText("← Floor Plan");
        fireEvent.click(backBtn);

        await waitFor(() => {
            expect(screen.getByText("Server Station")).toBeInTheDocument();
            expect(screen.getByText("Unassigned")).toBeInTheDocument();
        });
    });

    it("6. Floor plan displays Ready for Distribution at Kitchen Pass section and Table 2 has pulsing Ready to Distribute alert", async () => {
        renderServerStation("/server");

        await waitFor(() => {
            expect(screen.getByText(/Ready for Distribution at Kitchen Pass/i)).toBeInTheDocument();
        });

        // Shows ticket and item details
        expect(screen.getByText("#KOT-701")).toBeInTheDocument();
        expect(screen.getByText("Paneer Tikka")).toBeInTheDocument();
        expect(screen.getByText("(Extra mint sauce)")).toBeInTheDocument();

        // Floor plan Table 2 shows Ready to Distribute alert
        expect(screen.getAllByText(/Ready to Distribute!/i).length).toBeGreaterThan(0);
    });

    it("7. Clicking 'Served / Distributed' marks ready ticket as SERVED", async () => {
        renderServerStation("/server");

        await waitFor(() => {
            expect(screen.getByText(/Ready for Distribution at Kitchen Pass/i)).toBeInTheDocument();
        });

        const servedBtn = screen.getByRole("button", { name: /Served \/ Distributed/i });
        fireEvent.click(servedBtn);

        await waitFor(() => {
            expect(axios.put).toHaveBeenCalledWith(
                expect.stringContaining("/kots/701/status"),
                expect.objectContaining({ status: "SERVED" })
            );
        });
    });
});
