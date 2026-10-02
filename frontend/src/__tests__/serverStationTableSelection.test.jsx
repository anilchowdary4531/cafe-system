import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import Server from "../pages/Server";
import { BrowserRouter } from "react-router-dom";
import axios from "axios";

const mockLoggedInServer = {
    id: 101,
    name: "Kamesh Waiter",
    email: "kamesh@tiffzy.com",
    role: "WAITER",
    designation: "Server",
    restaurantId: 1,
    restaurant: { id: 1, name: "Tiffzy Cafe" },
};

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({
        user: mockLoggedInServer,
        token: "mock-jwt-token",
        logout: vi.fn(),
    }),
}));

vi.mock("../context/StaffSocketContext", () => ({
    useStaffSocket: () => ({
        socket: {
            on: vi.fn(),
            off: vi.fn(),
        },
    }),
}));

vi.mock("axios", () => {
    const mockAxios = {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        create: vi.fn(),
        interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() },
        },
    };
    mockAxios.create.mockReturnValue(mockAxios);
    return { default: mockAxios };
});

const mockTables = [
    {
        id: 1,
        tableNo: "Table 1",
        seats: 4,
        section: "Main Hall",
        isOccupied: false,
        isBlocked: false,
        assignedWaiterId: null,
        assignedWaiterName: null,
    },
    {
        id: 2,
        tableNo: "Table 2",
        seats: 2,
        section: "Main Hall",
        isOccupied: true,
        isBlocked: false,
        assignedWaiterId: 101,
        assignedWaiterName: "Kamesh Waiter",
    },
];

describe("Server Station Table Selection & Server Assignment Tests", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        axios.get.mockImplementation((url) => {
            if (url.includes("/tables")) {
                return Promise.resolve({ data: { tables: mockTables } });
            }
            if (url.includes("/menu")) {
                return Promise.resolve({ data: { items: [] } });
            }
            if (url.includes("/orders")) {
                return Promise.resolve({ data: { orders: [] } });
            }
            if (url.includes("/reservations")) {
                return Promise.resolve({ data: { reservations: [] } });
            }
            if (url.includes("/kots")) {
                return Promise.resolve({ data: { kots: [] } });
            }
            return Promise.resolve({ data: {} });
        });

        axios.post.mockResolvedValue({ data: { success: true } });
    });

    it("1. Displays assigned server name on Table 2 card", async () => {
        render(
            <BrowserRouter>
                <Server />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Table 1")).toBeInTheDocument();
            expect(screen.getByText("Table 2")).toBeInTheDocument();
        });

        // Table 2 is assigned to Kamesh Waiter
        expect(screen.getByText("Kamesh Waiter")).toBeInTheDocument();
    });

    it("2. Selecting Table 1 auto-assigns logged-in server (Kamesh Waiter) via POST assign-waiter API", async () => {
        render(
            <BrowserRouter>
                <Server />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Table 1")).toBeInTheDocument();
        });

        // Click Table 1 card to select
        const table1Card = screen.getByText("Table 1").closest("div");
        fireEvent.click(table1Card);

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("/tables/1/assign-waiter"),
                expect.objectContaining({
                    waiterId: 101,
                    reason: expect.any(String),
                })
            );
        });
    });
});
