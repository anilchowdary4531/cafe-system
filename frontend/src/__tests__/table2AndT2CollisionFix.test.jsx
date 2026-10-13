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

const mockTablesWithCollision = [
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

const mockStaffMembers = [
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

describe("OwnerLayout — Table 2 vs Table T2 Server Assignment Collision Isolation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();

        axios.get.mockImplementation((url) => {
            if (url.includes("/tables")) {
                return Promise.resolve({ data: mockTablesWithCollision });
            }
            if (url.includes("/staff")) {
                return Promise.resolve({ data: { users: mockStaffMembers } });
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

    it("1. Initially neither Table 2 nor Table T2 has an assigned server", async () => {
        renderOwnerPanel();

        await waitFor(() => {
            expect(screen.getByTitle("Assign server for Table T2")).toBeInTheDocument();
            expect(screen.getByTitle("Assign server for Table 2")).toBeInTheDocument();
        });

        expect(screen.queryByTitle(/Assigned: kamalesh/i)).not.toBeInTheDocument();
    });

    it("2. Assigning T2 -> kamalesh sends API call with targetTableId=2 and only assigns T2", async () => {
        renderOwnerPanel();

        await waitFor(() => {
            expect(screen.getByTitle("Assign server for Table T2")).toBeInTheDocument();
        });

        // Open staff selector for T2
        const t2ServerBtn = screen.getByTitle("Assign server for Table T2");
        fireEvent.click(t2ServerBtn);

        await waitFor(() => {
            expect(screen.getByText("Assign server for table T2")).toBeInTheDocument();
        });

        // Click kamalesh
        const kamaleshOption = screen.getByRole("button", { name: "kamalesh" });
        fireEvent.click(kamaleshOption);

        // Verify API was called with database ID 2 (T2's ID)
        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("/tables/2/assign-waiter"),
                expect.objectContaining({
                    waiterId: 101,
                    waiterName: "kamalesh",
                })
            );
        });

        // Verify T2 displays SV kamalesh
        await waitFor(() => {
            expect(screen.getByTitle("Assigned: kamalesh - Server")).toBeInTheDocument();
        });

        // CRUCIAL: Table 2 must NOT show kamalesh! It must still have "+ Server"
        expect(screen.getByTitle("Assign server for Table 2")).toBeInTheDocument();
    });

    it("3. Assigning Table 2 -> Priya Patel sends API call with targetTableId=6 and does not touch T2", async () => {
        renderOwnerPanel();

        await waitFor(() => {
            expect(screen.getByTitle("Assign server for Table 2")).toBeInTheDocument();
        });

        // Open staff selector for Table 2
        const table2ServerBtn = screen.getByTitle("Assign server for Table 2");
        fireEvent.click(table2ServerBtn);

        await waitFor(() => {
            expect(screen.getByText("Assign server for table 2")).toBeInTheDocument();
        });

        // Click Priya Patel
        const priyaOption = screen.getByRole("button", { name: "Priya Patel" });
        fireEvent.click(priyaOption);

        // Verify API was called with database ID 6 (Table 2's ID)
        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("/tables/6/assign-waiter"),
                expect.objectContaining({
                    waiterId: 102,
                    waiterName: "Priya Patel",
                })
            );
        });

        // Verify Table 2 displays SV Priya Patel
        await waitFor(() => {
            expect(screen.getByTitle("Assigned: Priya Patel - Server")).toBeInTheDocument();
        });

        // T2 must remain unassigned
        expect(screen.getByTitle("Assign server for Table T2")).toBeInTheDocument();
    });

    it("4. Legacy localStorage containing ambiguous key '2' does not pollute Table 2 or T2", async () => {
        // Simulate legacy storage containing {"2": "101"}
        localStorage.setItem("owner_table_staff_assignments_v1_1", JSON.stringify({ "2": "101" }));

        renderOwnerPanel();

        await waitFor(() => {
            expect(screen.getByTitle("Assign server for Table T2")).toBeInTheDocument();
            expect(screen.getByTitle("Assign server for Table 2")).toBeInTheDocument();
        });

        // Neither table should be assigned to kamalesh because un-prefixed "2" is ignored
        expect(screen.queryByTitle(/Assigned: kamalesh/i)).not.toBeInTheDocument();
    });

    it("5. Drop event on T2 passes the table object and targets ID 2", async () => {
        renderOwnerPanel();

        await waitFor(() => {
            expect(screen.getByTitle("Assign server for Table T2")).toBeInTheDocument();
        });

        const t2Card = screen.getByTitle(/Table T2 - Free/i);

        // Simulate dropping staff 101 onto T2
        fireEvent.drop(t2Card, {
            dataTransfer: {
                getData: (format) => (format === "text/plain" ? "101" : ""),
            },
        });

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("/tables/2/assign-waiter"),
                expect.objectContaining({
                    waiterId: 101,
                    waiterName: "kamalesh",
                })
            );
        });
    });
});
