import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import OwnerLayout from "../layouts/OwnerLayout.jsx";
import OwnerTables from "../pages/admin/OwnerTables.jsx";
import { isServerStaff, isServerDesignation } from "../utils/staffRole.js";
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
        user: { id: 1, restaurantId: 1, name: "Cafe King Owner", role: "OWNER", designation: "Owner" },
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
        id: 2,
        tableNo: "2",
        seats: 4,
        isOccupied: false,
        assignedWaiterId: null,
        assignedWaiterName: null,
        activeOrders: [],
    },
    {
        id: 4,
        tableNo: "4",
        seats: 4,
        isOccupied: false,
        assignedWaiterId: null,
        assignedWaiterName: null,
        activeOrders: [],
    },
];

// Diverse restaurant staff pool matching exact production scenario
const mockAllStaffMembers = [
    { id: 101, name: "Kamalesh", role: "WAITER", designation: "Server", isActive: true },
    { id: 102, name: "Sharuku", role: "WAITER", designation: "Server", isActive: true },
    { id: 103, name: "Ramesh", role: "STAFF", designation: "Server", isActive: true },
    { id: 104, name: "Anil", role: "WAITER", designation: "Waiter", isActive: true },
    { id: 105, name: "Cafe King Cashier", role: "CASHIER", designation: "Cashier", isActive: true },
    { id: 106, name: "Cafe King Chef", role: "CHEF", designation: "Chef", isActive: true },
    { id: 107, name: "Cafe King Chef R14", role: "CHEF", designation: "Senior Chef", isActive: true },
    { id: 108, name: "Cafe King Manager", role: "MANAGER", designation: "Manager", isActive: true },
    { id: 109, name: "Cafe King Owner", role: "OWNER", designation: "Owner", isActive: true },
    { id: 110, name: "Steward Dave", role: "STEWARD", designation: "Steward", isActive: true },
    { id: 111, name: "Cleaner Bob", role: "CLEANER", designation: "Cleaner", isActive: true },
    { id: 112, name: "Swiper Sam", role: "SWIPER", designation: "Swiper", isActive: true },
    { id: 113, name: "Inactive Server John", role: "WAITER", designation: "Server", isActive: false },
];

describe("Table Server Assignment Filtering — Authoritative Designation Verification", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();

        axios.get.mockImplementation((url) => {
            if (url.includes("/tables")) {
                return Promise.resolve({ data: mockTables });
            }
            if (url.includes("/staff")) {
                return Promise.resolve({ data: { users: mockAllStaffMembers } });
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

    describe("1. Pure Helper Function Unit Tests: isServerStaff & isServerDesignation", () => {
        it("identifies active staff with Server designation as Server", () => {
            expect(isServerStaff({ role: "WAITER", designation: "Server", isActive: true })).toBe(true);
            expect(isServerStaff({ role: "STAFF", designation: "Server", isActive: true })).toBe(true);
            expect(isServerStaff({ role: "WAITER", designation: "SERVER", isActive: true })).toBe(true);
            expect(isServerStaff({ role: "STAFF", designation: "server", isActive: true })).toBe(true);
            expect(isServerStaff({ role: "WAITER", designation: "Waiter", isActive: true })).toBe(true);
            expect(isServerStaff({ role: "WAITER", designation: "", isActive: true })).toBe(true);
        });

        it("strictly rejects non-server designations even if role is STAFF", () => {
            expect(isServerStaff({ role: "CASHIER", designation: "Cashier", isActive: true })).toBe(false);
            expect(isServerStaff({ role: "CHEF", designation: "Chef", isActive: true })).toBe(false);
            expect(isServerStaff({ role: "CHEF", designation: "Senior Chef", isActive: true })).toBe(false);
            expect(isServerStaff({ role: "MANAGER", designation: "Manager", isActive: true })).toBe(false);
            expect(isServerStaff({ role: "OWNER", designation: "Owner", isActive: true })).toBe(false);
            expect(isServerStaff({ role: "STEWARD", designation: "Steward", isActive: true })).toBe(false);
            expect(isServerStaff({ role: "CLEANER", designation: "Cleaner", isActive: true })).toBe(false);
            expect(isServerStaff({ role: "SWIPER", designation: "Swiper", isActive: true })).toBe(false);
        });

        it("strictly rejects inactive servers (isActive: false)", () => {
            expect(isServerStaff({ role: "WAITER", designation: "Server", isActive: false })).toBe(false);
        });
    });

    describe("2. OwnerLayout '+ Server' Popover Component Verification", () => {
        const renderOwnerLayout = () =>
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

        it("shows ONLY active Servers and excludes all non-servers in Table 2 popover", async () => {
            renderOwnerLayout();

            await waitFor(() => {
                expect(screen.getByTitle("Assign server for Table 2")).toBeInTheDocument();
            });

            // Click "+ Server" for Table 2
            fireEvent.click(screen.getByTitle("Assign server for Table 2"));

            await waitFor(() => {
                expect(screen.getByText("Assign server for table 2")).toBeInTheDocument();
            });

            // 1. Kamalesh MUST BE SHOWN
            expect(screen.getByText("Kamalesh")).toBeInTheDocument();
            // 2. Sharuku MUST BE SHOWN
            expect(screen.getByText("Sharuku")).toBeInTheDocument();
            // 3. Other valid Servers (Ramesh, Anil) MUST BE SHOWN
            expect(screen.getByText("Ramesh")).toBeInTheDocument();
            expect(screen.getByText("Anil")).toBeInTheDocument();

            // 4. Non-servers MUST NOT BE SHOWN
            expect(screen.queryByText("Cafe King Cashier")).not.toBeInTheDocument();
            expect(screen.queryByText("Cafe King Chef")).not.toBeInTheDocument();
            expect(screen.queryByText("Cafe King Chef R14")).not.toBeInTheDocument();
            expect(screen.queryByText("Cafe King Manager")).not.toBeInTheDocument();
            expect(screen.queryByText("Cafe King Owner")).not.toBeInTheDocument();
            expect(screen.queryByText("Steward Dave")).not.toBeInTheDocument();
            expect(screen.queryByText("Cleaner Bob")).not.toBeInTheDocument();
            expect(screen.queryByText("Swiper Sam")).not.toBeInTheDocument();
            expect(screen.queryByText("Inactive Server John")).not.toBeInTheDocument();
        });

        it("works consistently for other tables (e.g., Table 4)", async () => {
            renderOwnerLayout();

            await waitFor(() => {
                expect(screen.getByTitle("Assign server for Table 4")).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTitle("Assign server for Table 4"));

            await waitFor(() => {
                expect(screen.getByText("Assign server for table 4")).toBeInTheDocument();
            });

            expect(screen.getByText("Kamalesh")).toBeInTheDocument();
            expect(screen.getByText("Sharuku")).toBeInTheDocument();
            expect(screen.queryByText("Cafe King Cashier")).not.toBeInTheDocument();
            expect(screen.queryByText("Cafe King Owner")).not.toBeInTheDocument();
        });

        it("successfully assigns Kamalesh to Table 2 on click", async () => {
            renderOwnerLayout();

            await waitFor(() => {
                expect(screen.getByTitle("Assign server for Table 2")).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTitle("Assign server for Table 2"));

            await waitFor(() => {
                expect(screen.getByText("Kamalesh")).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText("Kamalesh"));

            await waitFor(() => {
                expect(axios.post).toHaveBeenCalledWith(
                    expect.stringContaining("/tables/2/assign-waiter"),
                    expect.objectContaining({
                        waiterId: 101,
                        waiterName: "Kamalesh",
                    })
                );
            });
        });

        it("displays 'No servers available' when there are 0 active servers", async () => {
            axios.get.mockImplementation((url) => {
                if (url.includes("/tables")) return Promise.resolve({ data: mockTables });
                if (url.includes("/staff")) {
                    return Promise.resolve({
                        data: {
                            users: [
                                { id: 201, name: "Cashier Only", role: "CASHIER", designation: "Cashier", isActive: true },
                                { id: 202, name: "Chef Only", role: "CHEF", designation: "Chef", isActive: true },
                            ],
                        },
                    });
                }
                return Promise.resolve({ data: [] });
            });

            renderOwnerLayout();

            await waitFor(() => {
                expect(screen.getByTitle("Assign server for Table 2")).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTitle("Assign server for Table 2"));

            await waitFor(() => {
                expect(screen.getByText("No servers available")).toBeInTheDocument();
            });

            expect(screen.queryByText("Cashier Only")).not.toBeInTheDocument();
            expect(screen.queryByText("Chef Only")).not.toBeInTheDocument();
        });
    });

    describe("3. OwnerTables Modal Component Verification", () => {
        const renderOwnerTables = () =>
            render(
                <MemoryRouter initialEntries={["/owner/tables"]}>
                    <LanguageProvider>
                        <RestaurantThemeProvider>
                            <RestaurantContextProvider>
                                <OwnerTables />
                            </RestaurantContextProvider>
                        </RestaurantThemeProvider>
                    </LanguageProvider>
                </MemoryRouter>
            );

        it("renders ONLY active servers in the select dropdown inside Assign Server Modal", async () => {
            renderOwnerTables();

            await waitFor(() => {
                expect(screen.getByTitle("Assign server to Table 2")).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTitle("Assign server to Table 2"));

            await waitFor(() => {
                expect(screen.getByText(/Assign Server to Table 2/i)).toBeInTheDocument();
            });

            const selectEl = screen.getByLabelText("Select Server / Waiter");
            expect(selectEl).toBeInTheDocument();

            // Check options inside the select element
            const optionTexts = Array.from(selectEl.options).map((opt) => opt.text);

            expect(optionTexts.some((t) => t.includes("Kamalesh"))).toBe(true);
            expect(optionTexts.some((t) => t.includes("Sharuku"))).toBe(true);
            expect(optionTexts.some((t) => t.includes("Ramesh"))).toBe(true);
            expect(optionTexts.some((t) => t.includes("Anil"))).toBe(true);

            expect(optionTexts.some((t) => t.includes("Cafe King Cashier"))).toBe(false);
            expect(optionTexts.some((t) => t.includes("Cafe King Chef"))).toBe(false);
            expect(optionTexts.some((t) => t.includes("Cafe King Manager"))).toBe(false);
            expect(optionTexts.some((t) => t.includes("Cafe King Owner"))).toBe(false);
            expect(optionTexts.some((t) => t.includes("Steward Dave"))).toBe(false);
            expect(optionTexts.some((t) => t.includes("Cleaner Bob"))).toBe(false);
            expect(optionTexts.some((t) => t.includes("Inactive Server John"))).toBe(false);
        });
    });
});
