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
];

const mockAuditStaff = [
    {
        id: 101,
        name: "Server A",
        role: "WAITER",
        designation: "Server",
        isActive: true,
    },
    {
        id: 102,
        name: "Server B",
        role: "WAITER",
        designation: "Server",
        isActive: true,
    },
];

describe("Owner Tables QA — 10 REGRESSION SCENARIOS TEST SUITE", () => {
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

    // TEST 1: Rapidly click Server A 5 times. Expected: Exactly 1 POST.
    it("TEST 1: Rapidly click Server A 5 times results in exactly 1 POST", async () => {
        let postCount = 0;
        axios.post.mockImplementation(() => {
            postCount++;
            return new Promise((resolve) => setTimeout(() => resolve({ data: { ok: true } }), 100));
        });

        renderDashboard();
        await waitFor(() => expect(screen.getByTitle("Assign server for Table 2")).toBeInTheDocument());

        fireEvent.click(screen.getByTitle("Assign server for Table 2"));
        await waitFor(() => expect(screen.getByRole("button", { name: "Server A" })).toBeInTheDocument());

        const serverABtn = screen.getByRole("button", { name: "Server A" });
        fireEvent.click(serverABtn);
        fireEvent.click(serverABtn);
        fireEvent.click(serverABtn);
        fireEvent.click(serverABtn);
        fireEvent.click(serverABtn);

        expect(postCount).toBe(1);
    });

    // TEST 2: Assign Server A to Table 2. Expected: Table 2 = Server A, T2 = unchanged.
    it("TEST 2: Assign Server A to Table 2 -> Table 2 = Server A, T2 = unchanged", async () => {
        renderDashboard();
        await waitFor(() => expect(screen.getByTitle("Assign server for Table 2")).toBeInTheDocument());

        fireEvent.click(screen.getByTitle("Assign server for Table 2"));
        await waitFor(() => expect(screen.getByRole("button", { name: "Server A" })).toBeInTheDocument());
        fireEvent.click(screen.getByRole("button", { name: "Server A" }));

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("/tables/6/assign-waiter"),
                expect.objectContaining({ waiterId: 101, waiterName: "Server A" })
            );
        });

        // Table 2 receives Server A
        await waitFor(() => {
            expect(screen.getByTitle("Assigned: Server A - Server")).toBeInTheDocument();
        });

        // T2 remains unassigned (+ Server)
        expect(screen.getByTitle("Assign server for Table T2")).toBeInTheDocument();
    });

    // TEST 3: Assign Server B to T2. Expected: T2 = Server B, Table 2 = Server A.
    it("TEST 3: Assign Server B to T2 -> T2 = Server B, Table 2 = Server A", async () => {
        renderDashboard();
        await waitFor(() => expect(screen.getByTitle("Assign server for Table 2")).toBeInTheDocument());

        // Assign Server A to Table 2
        fireEvent.click(screen.getByTitle("Assign server for Table 2"));
        await waitFor(() => expect(screen.getByRole("button", { name: "Server A" })).toBeInTheDocument());
        fireEvent.click(screen.getByRole("button", { name: "Server A" }));
        await waitFor(() => expect(screen.getByTitle("Assigned: Server A - Server")).toBeInTheDocument());

        // Assign Server B to T2
        fireEvent.click(screen.getByTitle("Assign server for Table T2"));
        await waitFor(() => expect(screen.getByRole("button", { name: "Server B" })).toBeInTheDocument());
        fireEvent.click(screen.getByRole("button", { name: "Server B" }));

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("/tables/2/assign-waiter"),
                expect.objectContaining({ waiterId: 102, waiterName: "Server B" })
            );
        });

        // Both tables have independent servers
        await waitFor(() => {
            expect(screen.getByTitle("Assigned: Server A - Server")).toBeInTheDocument();
            expect(screen.getByTitle("Assigned: Server B - Server")).toBeInTheDocument();
        });
    });

    // TEST 4: GET /owner/:restaurantId/tables returns 500. Expected: Error UI + Retry button, No "No tables found."
    it("TEST 4: GET /owner/:restaurantId/tables returns 500 renders Error UI + Retry button, no 'No tables found.'", async () => {
        let failure = true;
        axios.get.mockImplementation((url) => {
            if (url.includes("/tables")) {
                if (failure) return Promise.reject(new Error("Server error 500"));
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

        // Clicking retry reloads table overview
        failure = false;
        fireEvent.click(screen.getByRole("button", { name: "Retry" }));
        await waitFor(() => {
            expect(screen.getByText("Tables: 2")).toBeInTheDocument();
            expect(screen.queryByText("Unable to load tables")).not.toBeInTheDocument();
        });
    });

    // TEST 5: GET /owner/:restaurantId/tables returns []. Expected: "No tables found."
    it("TEST 5: GET /owner/:restaurantId/tables returns [] displays 'No tables found.'", async () => {
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

    // TEST 6: Verify staff DOM. Expected: draggable="true" exists on intended staff elements.
    it("TEST 6: Verify staff DOM has draggable='true' on intended staff elements", async () => {
        renderDashboard();
        await waitFor(() => expect(screen.getByTitle("Assign server for Table 2")).toBeInTheDocument());

        fireEvent.click(screen.getByTitle("Assign server for Table 2"));
        await waitFor(() => expect(screen.getByRole("button", { name: "Server A" })).toBeInTheDocument());

        const staffOptions = document.querySelectorAll(".theme-table-staff-option");
        expect(staffOptions.length).toBeGreaterThan(0);
        staffOptions.forEach((btn) => {
            expect(btn.getAttribute("draggable")).toBe("true");
        });
    });

    // TEST 7: Drag Server A -> Table 2. Expected: Table 2 assigned.
    it("TEST 7: Drag Server A -> Table 2 assigns Server A to Table 2 (ID: 6)", async () => {
        renderDashboard();
        await waitFor(() => expect(screen.getByTitle("Assign server for Table 2")).toBeInTheDocument());

        fireEvent.click(screen.getByTitle("Assign server for Table 2"));
        await waitFor(() => expect(screen.getByRole("button", { name: "Server A" })).toBeInTheDocument());

        const serverABtn = screen.getByRole("button", { name: "Server A" });
        const dataTransfer = {
            data: {},
            setData: vi.fn((format, data) => { dataTransfer.data[format] = data; }),
            getData: vi.fn((format) => dataTransfer.data[format] || ""),
            types: ["text/plain"],
        };

        fireEvent.dragStart(serverABtn, { dataTransfer });
        expect(dataTransfer.setData).toHaveBeenCalledWith("text/plain", "101");

        const table2Card = screen.getByTitle("Table 2 - Free");
        fireEvent.drop(table2Card, { dataTransfer });

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("/tables/6/assign-waiter"),
                expect.objectContaining({ waiterId: 101, waiterName: "Server A" })
            );
        });

        await waitFor(() => {
            expect(screen.getByTitle("Assigned: Server A - Server")).toBeInTheDocument();
        });
    });

    // TEST 8: Drag Server B -> T2. Expected: T2 assigned.
    it("TEST 8: Drag Server B -> T2 assigns Server B to T2 (ID: 2)", async () => {
        renderDashboard();
        await waitFor(() => expect(screen.getByTitle("Assign server for Table T2")).toBeInTheDocument());

        fireEvent.click(screen.getByTitle("Assign server for Table T2"));
        await waitFor(() => expect(screen.getByRole("button", { name: "Server B" })).toBeInTheDocument());

        const serverBBtn = screen.getByRole("button", { name: "Server B" });
        const dataTransfer = {
            data: {},
            setData: vi.fn((format, data) => { dataTransfer.data[format] = data; }),
            getData: vi.fn((format) => dataTransfer.data[format] || ""),
            types: ["text/plain"],
        };

        fireEvent.dragStart(serverBBtn, { dataTransfer });
        expect(dataTransfer.setData).toHaveBeenCalledWith("text/plain", "102");

        const tableT2Card = screen.getByTitle("Table T2 - Free");
        fireEvent.drop(tableT2Card, { dataTransfer });

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("/tables/2/assign-waiter"),
                expect.objectContaining({ waiterId: 102, waiterName: "Server B" })
            );
        });

        await waitFor(() => {
            expect(screen.getByTitle("Assigned: Server B - Server")).toBeInTheDocument();
        });
    });

    // TEST 9: Refresh page after assignments. Expected: Assignments persist independently.
    it("TEST 9: Page refresh loads persistent independent assignments for Table 2 and T2", async () => {
        // Backend returns Table 2 = Server A, T2 = Server B
        axios.get.mockImplementation((url) => {
            if (url.includes("/tables")) {
                return Promise.resolve({
                    data: [
                        { ...mockAuditTables[0], assignedWaiterId: 101, assignedWaiterName: "Server A" },
                        { ...mockAuditTables[1], assignedWaiterId: 102, assignedWaiterName: "Server B" },
                    ],
                });
            }
            if (url.includes("/staff")) return Promise.resolve({ data: { users: mockAuditStaff } });
            return Promise.resolve({ data: [] });
        });

        renderDashboard();

        await waitFor(() => {
            expect(screen.getByTitle("Assigned: Server A - Server")).toBeInTheDocument();
            expect(screen.getByTitle("Assigned: Server B - Server")).toBeInTheDocument();
        });
    });

    // TEST 10: Open two browser windows. Assign in Window A. Expected: Window B updates through Socket.IO.
    it("TEST 10: Socket.IO table:updated synchronizes Window B in real time", async () => {
        renderDashboard();
        await waitFor(() => {
            expect(screen.getByTitle("Assign server for Table 2")).toBeInTheDocument();
        });

        // Window A assigns waiter 101 to table 6; Window B receives Socket.IO event and fetches fresh state
        axios.get.mockImplementation((url) => {
            if (url.includes("/tables")) {
                return Promise.resolve({
                    data: [
                        { ...mockAuditTables[0], assignedWaiterId: 101, assignedWaiterName: "Server A" },
                        mockAuditTables[1],
                    ],
                });
            }
            if (url.includes("/staff")) return Promise.resolve({ data: { users: mockAuditStaff } });
            return Promise.resolve({ data: [] });
        });

        expect(socketListeners["table:updated"]).toBeDefined();
        socketListeners["table:updated"]({ restaurantId: 4, tableId: 6, tableNo: "2", assignedWaiterId: 101 });

        await waitFor(() => {
            expect(screen.getByTitle("Assigned: Server A - Server")).toBeInTheDocument();
        });
        // T2 remains untouched
        expect(screen.getByTitle("Assign server for Table T2")).toBeInTheDocument();
    });
});
