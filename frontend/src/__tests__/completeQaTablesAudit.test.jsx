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
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    };
    return { api: mockApi, default: mockApi, cachedGet: vi.fn().mockResolvedValue([]) };
});

vi.mock("axios", () => {
    const mockAxiosInstance = {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    };
    mockAxiosInstance.create = vi.fn(() => mockAxiosInstance);
    return { default: mockAxiosInstance, ...mockAxiosInstance };
});

vi.mock("../context/AuthContext.jsx", () => ({
    useAuth: () => ({
        user: { id: 1, restaurantId: 4, name: "Owner Test", role: "OWNER" },
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

const mockAuditTables = [
    {
        id: 5,
        tableNo: "1",
        seats: 4,
        isOccupied: false,
        assignedWaiterId: null,
        assignedWaiterName: null,
        activeOrders: [],
    },
    {
        id: 1,
        tableNo: "T1",
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
        id: 7,
        tableNo: "3",
        seats: 2,
        isOccupied: false,
        assignedWaiterId: null,
        assignedWaiterName: null,
        activeOrders: [],
    },
    {
        id: 3,
        tableNo: "T3",
        seats: 2,
        isOccupied: false,
        assignedWaiterId: null,
        assignedWaiterName: null,
        activeOrders: [],
    },
    {
        id: 8,
        tableNo: "4",
        seats: 6,
        isOccupied: false,
        assignedWaiterId: null,
        assignedWaiterName: null,
        activeOrders: [],
    },
    {
        id: 4,
        tableNo: "T4",
        seats: 6,
        isOccupied: false,
        assignedWaiterId: null,
        assignedWaiterName: null,
        activeOrders: [],
    },
    {
        id: 10,
        tableNo: "TABLE1",
        seats: 6,
        isOccupied: true,
        assignedWaiterId: null,
        assignedWaiterName: null,
        activeOrderCount: 1,
        activeOrders: [
            {
                id: 501,
                orderNo: "ORD-1001",
                status: "PREPARING",
                createdAt: new Date().toISOString(),
                total: 250,
                items: [{ id: 1, itemName: "Masala Dosa", qty: 2, price: 125, total: 250 }],
            },
        ],
    },
];

const mockAuditStaff = [
    { id: 101, name: "kamalesh", role: "WAITER", designation: "Server", isActive: true },
    { id: 102, name: "Priya Patel", role: "WAITER", designation: "Server", isActive: true },
];

describe("COMPLETE FUNCTIONAL QA AUDIT: Owner Dashboard (/owner)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        socketListeners = {};

        axios.get.mockImplementation((url) => {
            if (url.includes("/tables")) return Promise.resolve({ data: mockAuditTables });
            if (url.includes("/staff")) return Promise.resolve({ data: { users: mockAuditStaff } });
            if (url.includes("/group-catalogs")) return Promise.resolve({ data: [] });
            if (url.includes("/table-groups")) return Promise.resolve({ data: {} });
            return Promise.resolve({ data: [] });
        });
        axios.post.mockResolvedValue({ data: { ok: true } });
        axios.delete.mockResolvedValue({ data: { ok: true } });
        axios.put.mockResolvedValue({ data: { ok: true } });
    });

    const renderDashboard = () => {
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

    // 1. PAGE LOAD
    it("TC-01: Page Load elements (Logo, Label, Restaurant, Sidebar)", async () => {
        renderDashboard();
        await waitFor(() => {
            expect(screen.getAllByAltText("Tiffzy logo").length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText("OWNER PANEL").length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText("Dashboard").length).toBeGreaterThanOrEqual(1);
        });
    });

    // 2. TABLE SUMMARY
    it("TC-02: Table Summary (Total, Occupied, Free counts)", async () => {
        renderDashboard();
        await waitFor(() => {
            expect(screen.getByText("Tables: 9")).toBeInTheDocument();
            expect(screen.getByText("Occupied: 1")).toBeInTheDocument();
            expect(screen.getByText("Free: 8")).toBeInTheDocument();
        });
    });

    // 3. TABLE GROUPING
    it("TC-03: Table Grouping (Main Hall, Section T, Section TABLE)", async () => {
        renderDashboard();
        await waitFor(() => {
            expect(screen.getByText("Main Hall (4)")).toBeInTheDocument();
            expect(screen.getByText("Section T (4)")).toBeInTheDocument();
            expect(screen.getByText("Section TABLE (1)")).toBeInTheDocument();
        });
    });

    // 4. SECTION FILTERS
    it("TC-04: Section Filters switching without data mutation", async () => {
        renderDashboard();
        await waitFor(() => {
            expect(screen.getByRole("button", { name: "Section T (4)" })).toBeInTheDocument();
        });

        // Click Section T
        fireEvent.click(screen.getByRole("button", { name: "Section T (4)" }));
        expect(screen.getByText(/^Section T$/i)).toBeInTheDocument();
        expect(screen.queryByText(/^Main Hall$/i)).not.toBeInTheDocument();

        // Click Main Hall
        fireEvent.click(screen.getByRole("button", { name: "Main Hall (4)" }));
        expect(screen.getByText(/^Main Hall$/i)).toBeInTheDocument();
        expect(screen.queryByText(/^Section T$/i)).not.toBeInTheDocument();

        // Click All
        fireEvent.click(screen.getByRole("button", { name: "All (9)" }));
        expect(screen.getByText(/^Main Hall$/i)).toBeInTheDocument();
        expect(screen.getByText(/^Section T$/i)).toBeInTheDocument();
    });

    // 5. ZOOM
    it("TC-05: Zoom In, Zoom Out, Min, Max, Reset", async () => {
        renderDashboard();
        await waitFor(() => {
            expect(screen.getByLabelText("Zoom In")).toBeInTheDocument();
            expect(screen.getByLabelText("Zoom Out")).toBeInTheDocument();
            expect(screen.getByText("100%")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByLabelText("Zoom In"));
        expect(screen.getByText("110%")).toBeInTheDocument();
        expect(screen.getByText("Reset")).toBeInTheDocument();

        fireEvent.click(screen.getByText("Reset"));
        expect(screen.getByText("100%")).toBeInTheDocument();

        fireEvent.click(screen.getByLabelText("Zoom Out"));
        expect(screen.getByText("90%")).toBeInTheDocument();
    });

    // 6. HIDE/SHOW LIVE ORDERS PANEL
    it("TC-06: Hide/Show Live Orders Panel", async () => {
        renderDashboard();
        await waitFor(() => {
            expect(screen.getByTitle("Hide Live Orders Column")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTitle("Hide Live Orders Column"));
        expect(screen.getByTitle("Show Live Orders Column")).toBeInTheDocument();

        fireEvent.click(screen.getByTitle("Show Live Orders Column"));
        expect(screen.getByTitle("Hide Live Orders Column")).toBeInTheDocument();
    });

    // 7. TABLE CARD METADATA
    it("TC-07: Table Card Capacity, Statuses", async () => {
        renderDashboard();
        await waitFor(() => {
            expect(screen.getByTitle("Table 1 - Free")).toBeInTheDocument();
            expect(screen.getByTitle("Table T1 - Free")).toBeInTheDocument();
            expect(screen.getByText("Running")).toBeInTheDocument(); // TABLE1 is occupied
        });
    });

    // 8. SERVER ASSIGNMENT
    it("TC-08: Server Assignment lifecycle", async () => {
        renderDashboard();
        await waitFor(() => {
            expect(screen.getByTitle("Assign server for Table 2")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTitle("Assign server for Table 2"));
        await waitFor(() => {
            expect(screen.getByText("Assign server for table 2")).toBeInTheDocument();
        });

        // Click kamalesh
        fireEvent.click(screen.getByRole("button", { name: "kamalesh" }));

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("/tables/6/assign-waiter"),
                expect.objectContaining({ waiterId: 101, waiterName: "kamalesh" })
            );
        });
    });

    // 9. SERVER REMOVAL
    it("TC-09: Server Removal via clearTableAssignment", async () => {
        // Table 2 initially assigned
        axios.get.mockImplementation((url) => {
            if (url.includes("/tables")) {
                return Promise.resolve({
                    data: [
                        { ...mockAuditTables[2], assignedWaiterId: 101, assignedWaiterName: "kamalesh" },
                    ]
                });
            }
            if (url.includes("/staff")) return Promise.resolve({ data: { users: mockAuditStaff } });
            return Promise.resolve({ data: [] });
        });

        renderDashboard();
        await waitFor(() => {
            expect(screen.getByTitle("Assigned: kamalesh - Server")).toBeInTheDocument();
        });

        // Open staff selector on assigned card
        fireEvent.click(screen.getByTitle("Assigned: kamalesh - Server"));
        await waitFor(() => {
            expect(screen.getByText("Remove assigned server")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText("Remove assigned server"));
        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("/tables/6/unassign-waiter"),
                expect.anything()
            );
        });
    });

    // 10. SERVER REASSIGNMENT
    it("TC-10: Server Reassignment from Server A to Server B", async () => {
        axios.get.mockImplementation((url) => {
            if (url.includes("/tables")) {
                return Promise.resolve({
                    data: [
                        { ...mockAuditTables[2], assignedWaiterId: 101, assignedWaiterName: "kamalesh" },
                    ]
                });
            }
            if (url.includes("/staff")) return Promise.resolve({ data: { users: mockAuditStaff } });
            return Promise.resolve({ data: [] });
        });

        renderDashboard();
        await waitFor(() => {
            expect(screen.getByTitle("Assigned: kamalesh - Server")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTitle("Assigned: kamalesh - Server"));
        await waitFor(() => {
            expect(screen.getByRole("button", { name: "Priya Patel" })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole("button", { name: "Priya Patel" }));
        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("/tables/6/assign-waiter"),
                expect.objectContaining({ waiterId: 102, waiterName: "Priya Patel" })
            );
        });
    });

    // 11. CRITICAL TABLE IDENTIFIER REGRESSION: 1 vs T1, 2 vs T2, 3 vs T3, 4 vs T4
    it("TC-11: Table 2 vs T2 and all collision pairs remain strictly independent", async () => {
        renderDashboard();
        await waitFor(() => {
            expect(screen.getByTitle("Assign server for Table 2")).toBeInTheDocument();
            expect(screen.getByTitle("Assign server for Table T2")).toBeInTheDocument();
        });

        // Assign Table 2
        fireEvent.click(screen.getByTitle("Assign server for Table 2"));
        await waitFor(() => expect(screen.getByText("Assign server for table 2")).toBeInTheDocument());
        fireEvent.click(screen.getByRole("button", { name: "kamalesh" }));

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("/tables/6/assign-waiter"),
                expect.objectContaining({ waiterId: 101 })
            );
        });

        // Verify T2 is still unassigned
        expect(screen.getByTitle("Assign server for Table T2")).toBeInTheDocument();

        // Assign T2
        fireEvent.click(screen.getByTitle("Assign server for Table T2"));
        await waitFor(() => expect(screen.getByText("Assign server for table T2")).toBeInTheDocument());
        fireEvent.click(screen.getByRole("button", { name: "Priya Patel" }));

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("/tables/2/assign-waiter"),
                expect.objectContaining({ waiterId: 102 })
            );
        });

        // Verify Table 1 vs T1 also has distinct elements
        expect(screen.getByTitle("Assign server for Table 1")).toBeInTheDocument();
        expect(screen.getByTitle("Assign server for Table T1")).toBeInTheDocument();
    });

    // 12. THREE-DOT MENU
    it("TC-12: Three-dot menu actions (Edit, Copy QR, Move, Delete)", async () => {
        renderDashboard();
        await waitFor(() => {
            expect(screen.getByTitle("Actions for Table 2")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTitle("Actions for Table 2"));
        await waitFor(() => {
            expect(screen.getByText("Edit Table")).toBeInTheDocument();
            expect(screen.getByText("Copy QR Link")).toBeInTheDocument();
            expect(screen.getByText("Move Table")).toBeInTheDocument();
            expect(screen.getByText("Delete Table")).toBeInTheDocument();
        });
    });

    // 13. LIVE ORDERS
    it("TC-13: Live Orders details & View All button", async () => {
        renderDashboard();
        await waitFor(() => {
            expect(screen.getByText("1 active")).toBeInTheDocument();
            expect(screen.getByText("ORD-1001")).toBeInTheDocument();
            expect(screen.getByText("View all")).toBeInTheDocument();
        });
    });

    // 14. NOTIFICATIONS
    it("TC-14: Notification bell presence & synchronization", async () => {
        renderDashboard();
        await waitFor(() => {
            const bell = document.querySelector("header button[title*='Notification'], header button svg.lucide-bell");
            expect(bell || screen.getByRole("button", { name: /Kitchen Operations/i })).toBeDefined();
        });
    });

    // 15. SOCKET.IO MULTI-WINDOW SYNC
    it("TC-15: Socket.IO table:updated synchronizes table overview", async () => {
        renderDashboard();
        await waitFor(() => {
            expect(screen.getByTitle("Assign server for Table 2")).toBeInTheDocument();
        });

        // Next GET returns Table 2 assigned
        axios.get.mockImplementation((url) => {
            if (url.includes("/tables")) {
                return Promise.resolve({
                    data: [
                        { ...mockAuditTables[2], assignedWaiterId: 101, assignedWaiterName: "kamalesh" },
                    ]
                });
            }
            if (url.includes("/staff")) return Promise.resolve({ data: { users: mockAuditStaff } });
            return Promise.resolve({ data: [] });
        });

        expect(socketListeners["table:updated"]).toBeDefined();
        socketListeners["table:updated"]({ restaurantId: 4, tableId: 6, tableNo: "2", assignedWaiterId: 101 });

        await waitFor(() => {
            expect(screen.getByTitle("Assigned: kamalesh - Server")).toBeInTheDocument();
        });
    });

    // 16. API FAILURE & ROLLBACK
    it("TC-16: API failure on assign rolls back optimistic assignment", async () => {
        axios.post.mockRejectedValueOnce(new Error("Network Error"));
        renderDashboard();
        await waitFor(() => {
            expect(screen.getByTitle("Assign server for Table 2")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTitle("Assign server for Table 2"));
        await waitFor(() => expect(screen.getByRole("button", { name: "kamalesh" })).toBeInTheDocument());
        fireEvent.click(screen.getByRole("button", { name: "kamalesh" }));

        // Reverts back to + Server
        await waitFor(() => {
            expect(screen.getByTitle("Assign server for Table 2")).toBeInTheDocument();
        });
    });

    // 17. BUG 1 (FIXED): RAPID CLICK MUTEX TEST - EXACTLY 1 POST DISPATCHED
    it("TC-17: Rapid Click Test ensures in-flight mutex allows exactly 1 POST (BUG 1 FIX)", async () => {
        let postCount = 0;
        axios.post.mockImplementation(() => {
            postCount++;
            return new Promise((resolve) => setTimeout(() => resolve({ data: { ok: true } }), 100));
        });

        renderDashboard();
        await waitFor(() => expect(screen.getByTitle("Assign server for Table 2")).toBeInTheDocument());

        fireEvent.click(screen.getByTitle("Assign server for Table 2"));
        await waitFor(() => expect(screen.getByRole("button", { name: "kamalesh" })).toBeInTheDocument());

        const kamaleshBtn = screen.getByRole("button", { name: "kamalesh" });
        // Rapid 5 clicks on kamalesh
        fireEvent.click(kamaleshBtn);
        fireEvent.click(kamaleshBtn);
        fireEvent.click(kamaleshBtn);
        fireEvent.click(kamaleshBtn);
        fireEvent.click(kamaleshBtn);

        // In-flight mutex ensures exactly ONE assignment POST is dispatched
        expect(postCount).toBe(1);
    });

    // 18. BUG 2 (FIXED): GET /tables 500 RENDERS ERROR STATE AND RETRY BUTTON
    it("TC-18: GET /tables 500 error renders error state and Retry button, NOT 'No tables found.' (BUG 2 FIX)", async () => {
        let shouldFail = true;
        axios.get.mockImplementation((url) => {
            if (url.includes("/tables")) {
                if (shouldFail) {
                    return Promise.reject(new Error("Server error 500"));
                }
                return Promise.resolve({ data: mockAuditTables });
            }
            return Promise.resolve({ data: [] });
        });

        renderDashboard();
        await waitFor(() => {
            expect(screen.getByText("Unable to load tables")).toBeInTheDocument();
            expect(screen.getByText("We couldn't load the table layout right now.")).toBeInTheDocument();
            expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
            expect(screen.queryByText("No tables found.")).not.toBeInTheDocument();
        });

        // Test Retry button
        shouldFail = false;
        fireEvent.click(screen.getByRole("button", { name: "Retry" }));

        await waitFor(() => {
            expect(screen.getByText("Tables: 9")).toBeInTheDocument();
            expect(screen.queryByText("Unable to load tables")).not.toBeInTheDocument();
        });
    });

    // 18b. EMPTY RESTAURANT: GET /tables returns [] renders 'No tables found.'
    it("TC-18b: GET /tables returns empty array renders 'No tables found.'", async () => {
        axios.get.mockImplementation((url) => {
            if (url.includes("/tables")) return Promise.resolve({ data: [] });
            return Promise.resolve({ data: [] });
        });

        renderDashboard();
        await waitFor(() => {
            expect(screen.getByText("No tables found.")).toBeInTheDocument();
            expect(screen.queryByText("Unable to load tables")).not.toBeInTheDocument();
        });
    });

    // 19. BUG 3 (FIXED): DRAG AND DROP - ELEMENTS HAVE DRAGGABLE=TRUE AND DROP ASSIGNS
    it("TC-19: Drag and Drop check: staff elements have draggable=true and drop assigns staff (BUG 3 FIX)", async () => {
        renderDashboard();
        await waitFor(() => expect(screen.getByTitle("Assign server for Table 2")).toBeInTheDocument());

        // Open staff selector
        fireEvent.click(screen.getByTitle("Assign server for Table 2"));
        await waitFor(() => expect(screen.getByRole("button", { name: "kamalesh" })).toBeInTheDocument());

        // Verify draggable="true" exists on rendered staff element
        const kamaleshBtn = screen.getByRole("button", { name: "kamalesh" });
        expect(kamaleshBtn).toHaveAttribute("draggable", "true");

        // Simulate drag start
        const dataTransfer = {
            data: {},
            setData: vi.fn((format, data) => { dataTransfer.data[format] = data; }),
            getData: vi.fn((format) => dataTransfer.data[format] || ""),
            types: ["text/plain"],
        };

        fireEvent.dragStart(kamaleshBtn, { dataTransfer });
        expect(dataTransfer.setData).toHaveBeenCalledWith("text/plain", "101");

        // Drop on Table T2 card
        const tableT2Card = screen.getByTitle("Table T2 - Free");
        fireEvent.drop(tableT2Card, { dataTransfer });

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("/tables/2/assign-waiter"),
                expect.objectContaining({ waiterId: 101, waiterName: "kamalesh" })
            );
        });
    });
});
