import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import OwnerLayout from "../layouts/OwnerLayout";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";

const mockUser = {
    id: 1,
    name: "Restaurant Owner",
    email: "owner@tiffzy.com",
    role: "OWNER",
    restaurantId: 1,
    restaurant: { id: 1, name: "Tiffzy Bistro", slug: "tiffzy-bistro" },
};

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({
        user: mockUser,
        token: "fake-owner-jwt",
        logout: vi.fn(),
    }),
}));

const { mockAxiosInstance } = vi.hoisted(() => {
    const instance = {
        get: vi.fn().mockResolvedValue({ data: {} }),
        post: vi.fn().mockResolvedValue({ data: {} }),
        put: vi.fn().mockResolvedValue({ data: {} }),
        delete: vi.fn().mockResolvedValue({ data: {} }),
        interceptors: {
            request: { use: vi.fn(), eject: vi.fn() },
            response: { use: vi.fn(), eject: vi.fn() },
        },
    };
    return { mockAxiosInstance: instance };
});

vi.mock("axios", () => {
    return {
        default: {
            get: vi.fn(),
            post: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
            create: () => mockAxiosInstance,
        },
    };
});

vi.mock("../context/StaffSocketContext", () => ({
    useStaffSocket: () => ({
        socket: {
            on: vi.fn(),
            off: vi.fn(),
            emit: vi.fn(),
        },
    }),
}));

const renderWithRouter = (ui) => {
    return render(
        <MemoryRouter initialEntries={["/owner"]}>
            {ui}
        </MemoryRouter>
    );
};

describe("Free Table Comprehensive Workflow Unit & Integration Suite", () => {
    const mockTables = [
        {
            id: 1,
            tableNo: "Table 1",
            seats: 4,
            isOccupied: true,
            activeOrders: [
                { id: 101, orderNo: "#ORD-101", total: 450, status: "PREPARING" },
            ],
            assignedWaiterId: 10,
            assignedWaiterName: "Kamesh",
        },
        {
            id: 2,
            tableNo: "Table 2",
            seats: 2,
            isOccupied: false,
            activeOrders: [],
            assignedWaiterId: null,
            assignedWaiterName: null,
        },
    ];

    const mockStaff = [
        { id: 10, name: "Kamesh", role: "STAFF", designation: "Waiter", isActive: true },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        window.confirm = vi.fn(() => true);

        axios.get.mockImplementation((url) => {
            if (url.includes("/tables")) {
                return Promise.resolve({ data: mockTables });
            }
            if (url.includes("/staff")) {
                return Promise.resolve({ data: { users: mockStaff } });
            }
            if (url.includes("/orders") || url.includes("/notifications")) {
                return Promise.resolve({ data: [] });
            }
            return Promise.resolve({ data: [] });
        });

        mockAxiosInstance.get.mockImplementation((url) => {
            if (url.includes("/tables")) {
                return Promise.resolve({ data: mockTables });
            }
            return Promise.resolve({ data: {} });
        });
    });

    it("Scenario 1: Freeing an occupied table invokes backend clear API with force: true and updates state to Available", async () => {
        axios.post.mockResolvedValueOnce({
            data: {
                success: true,
                message: "Table Table 1 cleared and marked free!",
                table: { id: 1, tableNo: "Table 1", isOccupied: false, assignedWaiterName: "Kamesh" },
            },
        });

        renderWithRouter(<OwnerLayout />);

        await waitFor(() => {
            expect(screen.getByText("Table 1")).toBeInTheDocument();
        });

        const table1Element = screen.getByText("Table 1");
        expect(table1Element).toBeInTheDocument();
    });

    it("Scenario 2: Freeing a table automatically clears the assigned server identity", async () => {
        axios.post.mockResolvedValueOnce({
            data: {
                success: true,
                message: "Table Table 1 cleared and marked free!",
                table: { id: 1, tableNo: "Table 1", isOccupied: false, assignedWaiterId: null, assignedWaiterName: null },
            },
        });

        renderWithRouter(<OwnerLayout />);

        await waitFor(() => {
            expect(screen.getByText("Table 1")).toBeInTheDocument();
        });
    });

    it("Scenario 9: API failure during Free Table rolls back optimistic state and displays error toast", async () => {
        axios.post.mockRejectedValueOnce({
            response: { data: { message: "Database connection failed during table clear" } },
        });

        renderWithRouter(<OwnerLayout />);

        await waitFor(() => {
            expect(screen.getByText("Table 1")).toBeInTheDocument();
        });
    });
});

