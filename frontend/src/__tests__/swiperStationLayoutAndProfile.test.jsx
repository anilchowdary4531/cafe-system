import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SwiperStation, { getAuthoritativeTotal } from "../pages/staff/SwiperStation";
import StaffProfileView from "../components/StaffProfileView";
import axios from "axios";

// Mock axios
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

// Mock AuthContext
const mockLogout = vi.fn();
let mockCurrentUser = {
    id: 99,
    name: "Alex Swiper",
    phone: "9876543210",
    role: "SWIPER",
    designation: "Swiper",
    restaurantId: 1,
    restaurant: { id: 1, name: "Tiffzy Grand Bistro" },
};

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({
        user: mockCurrentUser,
        token: "mock-swiper-token",
        logout: mockLogout,
    }),
}));

// Mock StaffSocketContext
const mockSocketOn = vi.fn();
const mockSocketOff = vi.fn();
vi.mock("../context/StaffSocketContext", () => ({
    useStaffSocket: () => ({
        socket: {
            on: mockSocketOn,
            off: mockSocketOff,
            connected: true,
        },
        connectionStatus: "connected",
        activeDesignation: "SWIPER",
    }),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual("react-router-dom");
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

describe("Swiper Station Layout & Profile Verification", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCurrentUser = {
            id: 99,
            name: "Alex Swiper",
            phone: "9876543210",
            role: "SWIPER",
            designation: "Swiper",
            restaurantId: 1,
            restaurant: { id: 1, name: "Tiffzy Grand Bistro" },
        };
    });

    describe("getAuthoritativeTotal helper", () => {
        it("returns direct total if valid number > 0", () => {
            expect(getAuthoritativeTotal({ total: "450" })).toBe(450);
            expect(getAuthoritativeTotal({ finalAmount: 520 })).toBe(520);
        });

        it("calculates from items when direct total is zero", () => {
            const order = {
                total: 0,
                items: [
                    { price: 100, qty: 2 },
                    { price: 50, qty: 1 },
                ],
                taxAmount: 10,
                discountAmount: 20,
            };
            expect(getAuthoritativeTotal(order)).toBe(240);
        });
    });

    describe("Swiper Station Full-Width Layout & Space Optimization", () => {
        it("renders full-width workstation without narrow max-w-4xl constraint", async () => {
            axios.get.mockResolvedValueOnce({
                data: {
                    orders: [],
                },
            });

            const { container } = render(
                <MemoryRouter>
                    <SwiperStation />
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(screen.getByText("Tables Awaiting Settlement")).toBeInTheDocument();
            });

            // Ensure no max-w-4xl constraint exists on the workspace
            expect(container.querySelector(".max-w-4xl")).toBeNull();

            // Main container should be w-full and flex-1
            const mainContent = container.querySelector(".w-full.flex-1.flex.flex-col");
            expect(mainContent).not.toBeNull();
        });

        it("renders header and search bar on the same row", async () => {
            axios.get.mockResolvedValueOnce({
                data: { orders: [] },
            });

            render(
                <MemoryRouter>
                    <SwiperStation />
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(screen.getByText("Tables Awaiting Settlement")).toBeInTheDocument();
            });

            const searchInput = screen.getByPlaceholderText(/search table # or bill/i);
            expect(searchInput).toBeInTheDocument();
            expect(searchInput.id).toBe("swiper-tables-search");

            // Check that search and title share the header flex container
            const headerRow = searchInput.closest(".flex.flex-col.sm\\:flex-row");
            expect(headerRow).not.toBeNull();
            expect(headerRow).toHaveTextContent("Tables Awaiting Settlement");
        });

        it("renders compact empty state when 0 tables await settlement", async () => {
            axios.get.mockResolvedValueOnce({
                data: { orders: [] },
            });

            const { container } = render(
                <MemoryRouter>
                    <SwiperStation />
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(screen.getByText(/no tables awaiting settlement/i)).toBeInTheDocument();
            });

            // Compact empty state should not be a large 150px boxed card
            const emptyNotice = screen.getByText(/no tables awaiting settlement/i).closest("div");
            expect(emptyNotice.className).toContain("py-3");
            expect(emptyNotice.className).not.toContain("p-12");
            expect(emptyNotice.className).not.toContain("py-8");
        });

        it("renders compact Select Table empty state when no table is selected", async () => {
            axios.get.mockResolvedValueOnce({
                data: { orders: [] },
            });

            render(
                <MemoryRouter>
                    <SwiperStation />
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(screen.getByText("Select a Table")).toBeInTheDocument();
            });

            expect(screen.getByText(/choose an unpaid table above to begin payment/i)).toBeInTheDocument();
        });

        it("renders responsive grid of tables when unpaid tables exist and expands settlement workspace on select", async () => {
            const mockOrders = [
                {
                    id: 101,
                    orderNo: "ORD-101",
                    tableNo: "4",
                    tableSessionId: 21,
                    total: 650,
                    status: "SERVED",
                    paymentStatus: "PENDING",
                    customer: { name: "John Doe", phone: "9876500000" },
                    items: [
                        { name: "Butter Chicken", qty: 2, price: 250 },
                        { name: "Garlic Naan", qty: 3, price: 50 },
                    ],
                },
                {
                    id: 102,
                    orderNo: "ORD-102",
                    tableNo: "7",
                    tableSessionId: 22,
                    total: 320,
                    status: "SERVED",
                    paymentStatus: "PENDING",
                    customer: { name: "Jane Smith" },
                    items: [{ name: "Paneer Tikka", qty: 1, price: 320 }],
                },
            ];

            axios.get.mockResolvedValueOnce({
                data: { orders: mockOrders },
            });

            const { container } = render(
                <MemoryRouter>
                    <SwiperStation />
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(screen.getByText("Table 4")).toBeInTheDocument();
                expect(screen.getByText("Table 7")).toBeInTheDocument();
            });

            // Check responsive grid exists
            const grid = container.querySelector(".grid.grid-cols-2");
            expect(grid).not.toBeNull();
            expect(grid.className).toContain("lg:grid-cols-6");

            // Select Table 4
            fireEvent.click(screen.getByTestId("swiper-table-card-101"));

            // Check that selected table workspace expands
            expect(screen.getByText("Bill #ORD-101")).toBeInTheDocument();
            expect(screen.getByText("Guest: John Doe • 9876500000")).toBeInTheDocument();
            expect(screen.getAllByText("₹650").length).toBeGreaterThan(0);
            expect(screen.getByText("Butter Chicken")).toBeInTheDocument();
            expect(screen.getByText("Garlic Naan")).toBeInTheDocument();

            // Check payment methods (EDC Card Swipe, Dynamic UPI QR, Tableside Cash)
            expect(screen.getByText("EDC Card Swipe")).toBeInTheDocument();
            expect(screen.getByText("Dynamic UPI QR")).toBeInTheDocument();
            expect(screen.getByText("Tableside Cash")).toBeInTheDocument();

            // Confirm payment button
            expect(screen.getByText(/Confirm ₹650 Paid via CARD/i)).toBeInTheDocument();

            // Switch to UPI
            fireEvent.click(screen.getByText("Dynamic UPI QR"));
            expect(screen.getByText(/Confirm ₹650 Paid via UPI/i)).toBeInTheDocument();
        });

        it("filters tables in realtime when search query is entered", async () => {
            const mockOrders = [
                { id: 101, orderNo: "ORD-101", tableNo: "12", total: 500, paymentStatus: "PENDING" },
                { id: 102, orderNo: "ORD-102", tableNo: "5", total: 300, paymentStatus: "PENDING" },
            ];

            axios.get.mockResolvedValueOnce({
                data: { orders: mockOrders },
            });

            render(
                <MemoryRouter>
                    <SwiperStation />
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(screen.getByText("Table 12")).toBeInTheDocument();
                expect(screen.getByText("Table 5")).toBeInTheDocument();
            });

            const searchInput = screen.getByPlaceholderText(/search table # or bill/i);
            fireEvent.change(searchInput, { target: { value: "12" } });

            expect(screen.getByText("Table 12")).toBeInTheDocument();
            expect(screen.queryByText("Table 5")).not.toBeInTheDocument();
        });
    });

    describe("Swiper Profile & Header Navigation", () => {
        it("renders accessible profile button in StaffShell", async () => {
            axios.get.mockResolvedValueOnce({ data: { orders: [] } });

            render(
                <MemoryRouter>
                    <SwiperStation />
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(screen.getByTestId("staff-profile-btn")).toBeInTheDocument();
            });

            const profileBtn = screen.getByTestId("staff-profile-btn");
            expect(profileBtn).toHaveAttribute("title", "My Profile");

            fireEvent.click(profileBtn);
            expect(mockNavigate).toHaveBeenCalledWith("/staff/profile");
        });

        it("StaffProfileView fetches authenticated staff details from /api/staff/profile/me", async () => {
            axios.get.mockResolvedValueOnce({
                data: {
                    success: true,
                    user: {
                        id: 99,
                        name: "Alex Swiper Live",
                        phone: "9988776655",
                        email: "alex.swiper@restaurant.com",
                        role: "SWIPER",
                        designation: "Swiper",
                        restaurant: { id: 1, name: "Tiffzy Grand Bistro" },
                    },
                },
            });

            render(
                <MemoryRouter>
                    <StaffProfileView />
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(axios.get).toHaveBeenCalledWith(
                    expect.stringContaining("/api/staff/profile/me"),
                    expect.any(Object)
                );
            });

            // Authenticated swiper details should be displayed
            await waitFor(() => {
                expect(screen.getByText("Alex Swiper Live")).toBeInTheDocument();
                expect(screen.getByText("alex.swiper@restaurant.com")).toBeInTheDocument();
                expect(screen.getByText("9988776655")).toBeInTheDocument();
                expect(screen.getAllByText("Swiper").length).toBeGreaterThan(0);
            });
        });

        it("StaffProfileView back button returns to /staff/swiper for authenticated swiper", async () => {
            axios.get.mockResolvedValueOnce({
                data: {
                    success: true,
                    user: {
                        id: 99,
                        name: "Alex Swiper",
                        role: "SWIPER",
                        designation: "Swiper",
                    },
                },
            });

            render(
                <MemoryRouter>
                    <StaffProfileView />
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(screen.getByText("Back to Swiper Station")).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText("Back to Swiper Station"));
            expect(mockNavigate).toHaveBeenCalledWith("/staff/swiper");
        });
    });
});
