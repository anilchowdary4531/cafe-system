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

const mockAuditTables = [
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

describe("Tiffzy Owner Panel — COMPLETE QA AUDIT TEST SUITE", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        socketListeners = {};
        localStorage.clear();

        axios.get.mockImplementation((url) => {
            if (url.includes("/tables")) {
                return Promise.resolve({ data: mockAuditTables });
            }
            if (url.includes("/staff")) {
                return Promise.resolve({ data: { users: mockAuditStaff } });
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

    const renderOwner = () => {
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

    // -------------------------------------------------------------
    // CRITICAL REGRESSION TEST: Table 2 vs Table T2 Independence
    // -------------------------------------------------------------
    describe("CRITICAL REGRESSION TEST: Table 2 vs Table T2 Collision Independence", () => {
        it("TC-REG-01: Table 2 and Table T2 render in separate sections with distinct labels", async () => {
            renderOwner();
            await waitFor(() => {
                expect(screen.getByTitle("Assign server for Table 2")).toBeInTheDocument();
                expect(screen.getByTitle("Assign server for Table T2")).toBeInTheDocument();
            });

            // Table 2 belongs to Main Hall
            expect(screen.getAllByText(/Main Hall/i).length).toBeGreaterThanOrEqual(1);
            // Table T2 belongs to Section T
            expect(screen.getAllByText(/Section T/i).length).toBeGreaterThanOrEqual(1);
            // TABLE1 belongs to Section TABLE
            expect(screen.getAllByText(/Section TABLE/i).length).toBeGreaterThanOrEqual(1);
        });

        it("TC-REG-02: Assign Server A (kamalesh) to Main Hall Table 2 -> T2 remains unchanged", async () => {
            renderOwner();
            await waitFor(() => {
                expect(screen.getByTitle("Assign server for Table 2")).toBeInTheDocument();
            });

            // Open staff selector for Table 2
            fireEvent.click(screen.getByTitle("Assign server for Table 2"));
            await waitFor(() => {
                expect(screen.getByText("Assign server for table 2")).toBeInTheDocument();
            });

            // Click kamalesh
            fireEvent.click(screen.getByRole("button", { name: "kamalesh" }));

            // Must call API for ID 6
            await waitFor(() => {
                expect(axios.post).toHaveBeenCalledWith(
                    expect.stringContaining("/tables/6/assign-waiter"),
                    expect.objectContaining({ waiterId: 101, waiterName: "kamalesh" })
                );
            });

            // Table 2 shows kamalesh
            await waitFor(() => {
                expect(screen.getByTitle("Assigned: kamalesh - Server")).toBeInTheDocument();
            });

            // T2 MUST NOT show kamalesh! Must remain '+ Server'
            expect(screen.getByTitle("Assign server for Table T2")).toBeInTheDocument();
        });

        it("TC-REG-03: Assign Server B (Priya Patel) to T2 -> Table 2 remains Server A (kamalesh)", async () => {
            // Backend returns Table 2 assigned to kamalesh (101), T2 unassigned
            axios.get.mockImplementation((url) => {
                if (url.includes("/tables")) {
                    return Promise.resolve({
                        data: [
                            mockAuditTables[0], // T2: null
                            { ...mockAuditTables[1], assignedWaiterId: 101, assignedWaiterName: "kamalesh" }, // Table 2: kamalesh
                            mockAuditTables[2],
                        ]
                    });
                }
                if (url.includes("/staff")) return Promise.resolve({ data: { users: mockAuditStaff } });
                return Promise.resolve({ data: [] });
            });

            renderOwner();
            await waitFor(() => {
                expect(screen.getByTitle("Assigned: kamalesh - Server")).toBeInTheDocument();
                expect(screen.getByTitle("Assign server for Table T2")).toBeInTheDocument();
            });

            // Open staff selector for T2
            fireEvent.click(screen.getByTitle("Assign server for Table T2"));
            await waitFor(() => {
                expect(screen.getByText("Assign server for table T2")).toBeInTheDocument();
            });

            // Click Priya Patel
            fireEvent.click(screen.getByRole("button", { name: "Priya Patel" }));

            // Must call API for ID 2 (T2)
            await waitFor(() => {
                expect(axios.post).toHaveBeenCalledWith(
                    expect.stringContaining("/tables/2/assign-waiter"),
                    expect.objectContaining({ waiterId: 102, waiterName: "Priya Patel" })
                );
            });

            // Both tables must have their respective servers assigned independently
            await waitFor(() => {
                expect(screen.getByTitle("Assigned: Priya Patel - Server")).toBeInTheDocument();
                expect(screen.getByTitle("Assigned: kamalesh - Server")).toBeInTheDocument();
            });
        });

        it("TC-REG-04: Refresh persistence keeps Table 2 and Table T2 assignments intact", async () => {
            // Backend returns both assigned
            axios.get.mockImplementation((url) => {
                if (url.includes("/tables")) {
                    return Promise.resolve({
                        data: [
                            { ...mockAuditTables[0], assignedWaiterId: 102, assignedWaiterName: "Priya Patel" },
                            { ...mockAuditTables[1], assignedWaiterId: 101, assignedWaiterName: "kamalesh" },
                            mockAuditTables[2],
                        ]
                    });
                }
                if (url.includes("/staff")) return Promise.resolve({ data: { users: mockAuditStaff } });
                return Promise.resolve({ data: [] });
            });

            renderOwner();
            await waitFor(() => {
                expect(screen.getByTitle("Assigned: kamalesh - Server")).toBeInTheDocument();
                expect(screen.getByTitle("Assigned: Priya Patel - Server")).toBeInTheDocument();
            });
        });

        it("TC-REG-05: Real-time Socket.IO table:updated for Table 2 does not affect T2", async () => {
            renderOwner();
            await waitFor(() => {
                expect(screen.getByTitle("Assign server for Table 2")).toBeInTheDocument();
                expect(screen.getByTitle("Assign server for Table T2")).toBeInTheDocument();
            });

            // Simulate backend returning Table 2 updated to Kamalesh on next GET
            axios.get.mockImplementation((url) => {
                if (url.includes("/tables")) {
                    return Promise.resolve({
                        data: [
                            { ...mockAuditTables[0], assignedWaiterId: null },
                            { ...mockAuditTables[1], assignedWaiterId: 101, assignedWaiterName: "kamalesh" },
                            mockAuditTables[2],
                        ]
                    });
                }
                return Promise.resolve({ data: [] });
            });

            // Trigger Socket.IO event
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

        it("TC-REG-06: Drag-and-drop staff onto T2 only targets table ID 2 and does not affect Table 2", async () => {
            renderOwner();
            await waitFor(() => {
                expect(screen.getByTitle("Assign server for Table T2")).toBeInTheDocument();
            });

            const t2Card = screen.getByTitle(/Table T2 - Free/i);
            fireEvent.drop(t2Card, {
                dataTransfer: {
                    getData: (type) => (type === "text/plain" ? "102" : ""),
                },
            });

            await waitFor(() => {
                expect(axios.post).toHaveBeenCalledWith(
                    expect.stringContaining("/tables/2/assign-waiter"),
                    expect.objectContaining({ waiterId: 102, waiterName: "Priya Patel" })
                );
            });

            // Table 2 still unassigned
            expect(screen.getByTitle("Assign server for Table 2")).toBeInTheDocument();
        });
    });

    // -------------------------------------------------------------
    // PRIMARY AREAS AUDIT TESTS (1 to 24)
    // -------------------------------------------------------------
    describe("Primary Functional Areas Audit", () => {
        it("TC-AUD-01: Area 1 - Table Loading correctly renders all tables", async () => {
            renderOwner();
            await waitFor(() => {
                expect(screen.getByText(/Tables: 3/i)).toBeInTheDocument();
                expect(screen.getByText(/Occupied: 1/i)).toBeInTheDocument();
                expect(screen.getByText(/Free: 2/i)).toBeInTheDocument();
            });
        });

        it("TC-AUD-02: Area 2 & 3 - Group filters (All, Main Hall, Section T, Section TABLE)", async () => {
            renderOwner();
            await waitFor(() => {
                expect(screen.getByRole("button", { name: /All \(3\)/i })).toBeInTheDocument();
                expect(screen.getByRole("button", { name: /Main Hall \(1\)/i })).toBeInTheDocument();
                expect(screen.getByRole("button", { name: /Section T \(1\)/i })).toBeInTheDocument();
                expect(screen.getByRole("button", { name: /Section TABLE \(1\)/i })).toBeInTheDocument();
            });

            // Filter to Section T
            fireEvent.click(screen.getByRole("button", { name: /^Section T \(1\)$/i }));
            expect(screen.getByText(/^Section T$/i)).toBeInTheDocument();
            expect(screen.queryByText(/^Main Hall$/i)).not.toBeInTheDocument();

            // Filter to Main Hall
            fireEvent.click(screen.getByRole("button", { name: /^Main Hall \(1\)$/i }));
            expect(screen.getByText(/^Main Hall$/i)).toBeInTheDocument();
            expect(screen.queryByText(/^Section T$/i)).not.toBeInTheDocument();

            // Back to All
            fireEvent.click(screen.getByRole("button", { name: /^All \(3\)$/i }));
            expect(screen.getByText(/^Main Hall$/i)).toBeInTheDocument();
            expect(screen.getByText(/^Section T$/i)).toBeInTheDocument();
        });

        it("TC-AUD-03: Area 4 - Table Status Handling (Available vs Running)", async () => {
            renderOwner();
            await waitFor(() => {
                // Table 2 and T2 are Available
                const availableBadges = screen.getAllByText("Available");
                expect(availableBadges.length).toBeGreaterThanOrEqual(2);
                // TABLE1 is Running
                expect(screen.getByText("Running")).toBeInTheDocument();
            });
        });

        it("TC-AUD-04: Area 5 - Three-dot table menu opens and shows actions", async () => {
            renderOwner();
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

        it("TC-AUD-05: Area 7 - Server Removal unassigns server from table", async () => {
            renderOwner();
            await waitFor(() => {
                expect(screen.getByTitle("Assign server for Table 2")).toBeInTheDocument();
            });

            // 1. Assign kamalesh
            fireEvent.click(screen.getByTitle("Assign server for Table 2"));
            await waitFor(() => {
                expect(screen.getByText("Assign server for table 2")).toBeInTheDocument();
            });
            fireEvent.click(screen.getByRole("button", { name: "kamalesh" }));

            await waitFor(() => {
                expect(screen.getByTitle("Assigned: kamalesh - Server")).toBeInTheDocument();
            });

            // 2. Remove kamalesh
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

            await waitFor(() => {
                expect(screen.getByTitle("Assign server for Table 2")).toBeInTheDocument();
            });
        });

        it("TC-AUD-06: Area 8 - Server Reassignment updates server from A to B", async () => {
            renderOwner();
            await waitFor(() => {
                expect(screen.getByTitle("Assign server for Table 2")).toBeInTheDocument();
            });

            // 1. Assign kamalesh
            fireEvent.click(screen.getByTitle("Assign server for Table 2"));
            await waitFor(() => {
                expect(screen.getByText("Assign server for table 2")).toBeInTheDocument();
            });
            fireEvent.click(screen.getByRole("button", { name: "kamalesh" }));

            await waitFor(() => {
                expect(screen.getByTitle("Assigned: kamalesh - Server")).toBeInTheDocument();
            });

            // 2. Reassign to Priya Patel
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

            await waitFor(() => {
                expect(screen.getByTitle("Assigned: Priya Patel - Server")).toBeInTheDocument();
            });
        });

        it("TC-AUD-07: Area 12 & 13 - Zoom controls (+, -, Reset)", async () => {
            renderOwner();
            await waitFor(() => {
                expect(screen.getByLabelText("Zoom In")).toBeInTheDocument();
                expect(screen.getByLabelText("Zoom Out")).toBeInTheDocument();
                expect(screen.getByText("100%")).toBeInTheDocument();
            });

            // Zoom in to 110%
            fireEvent.click(screen.getByLabelText("Zoom In"));
            expect(screen.getByText("110%")).toBeInTheDocument();
            expect(screen.getByText("Reset")).toBeInTheDocument();

            // Click Reset
            fireEvent.click(screen.getByText("Reset"));
            expect(screen.getByText("100%")).toBeInTheDocument();
            expect(screen.queryByText("Reset")).not.toBeInTheDocument();

            // Zoom out
            fireEvent.click(screen.getByLabelText("Zoom Out"));
            expect(screen.getByText("90%")).toBeInTheDocument();
        });

        it("TC-AUD-08: Area 14 & 15 - Hide/Restore Live Orders Panel", async () => {
            renderOwner();
            await waitFor(() => {
                expect(screen.getByTitle("Hide Live Orders Column")).toBeInTheDocument();
            });

            // Click Hide Panel
            fireEvent.click(screen.getByTitle("Hide Live Orders Column"));
            expect(screen.getByTitle("Show Live Orders Column")).toBeInTheDocument();

            // Click Live Orders to restore
            fireEvent.click(screen.getByTitle("Show Live Orders Column"));
            expect(screen.getByTitle("Hide Live Orders Column")).toBeInTheDocument();
        });

        it("TC-AUD-09: Area 15 & 16 - Live Orders active count and View All button", async () => {
            renderOwner();
            await waitFor(() => {
                expect(screen.getByText("1 active")).toBeInTheDocument();
                expect(screen.getByText("View all")).toBeInTheDocument();
                expect(screen.getByText("ORD-1001")).toBeInTheDocument();
            });

            const viewAllBtn = screen.getByText("View all");
            expect(viewAllBtn).toBeInTheDocument();
            expect(viewAllBtn.closest("button")).not.toBeDisabled();
        });

        it("TC-AUD-10: Area 17 - Notification bell presence", async () => {
            renderOwner();
            await waitFor(() => {
                expect(screen.getByRole("button", { name: /Open Kitchen Operations/i })).toBeInTheDocument();
            });

            const bellButtons = document.querySelectorAll("header button");
            const bell = Array.from(bellButtons).find(b => b.innerHTML.includes("lucide-bell"));
            expect(bell).toBeDefined();
        });

        it("TC-AUD-11: Area 20 - API failure rolls back assignment state", async () => {
            axios.post.mockRejectedValueOnce(new Error("Network Error"));
            renderOwner();
            await waitFor(() => {
                expect(screen.getByTitle("Assign server for Table 2")).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTitle("Assign server for Table 2"));
            await waitFor(() => {
                expect(screen.getByRole("button", { name: "kamalesh" })).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole("button", { name: "kamalesh" }));

            // Should revert back to unassigned
            await waitFor(() => {
                expect(screen.getByTitle("Assign server for Table 2")).toBeInTheDocument();
            });
        });
    });
});
