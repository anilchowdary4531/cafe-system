import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import Server from "../pages/Server";
import { BrowserRouter } from "react-router-dom";
import axios from "axios";
import { showToast } from "../utils/toast";

vi.mock("../utils/toast", () => ({
    showToast: vi.fn(),
}));

const mockLoggedInServer = {
    id: 101,
    name: "Ramesh Server",
    email: "ramesh@tiffzy.com",
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
        status: "AVAILABLE",
        isOccupied: false,
        isBlocked: false,
        assignedWaiterId: 101,
        assignedWaiterName: "Ramesh Server",
        activeOrders: [],
    },
];

const mockMenuItems = [
    {
        id: 10,
        name: "Paneer Tikka",
        category: "Starters",
        price: 250,
        isAvailable: true,
    },
];

describe("Server Station — Order Submission Idempotency & Single-Submission Protection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        axios.get.mockImplementation((url) => {
            const urlStr = String(url);
            if (urlStr.includes("/tables")) {
                return Promise.resolve({ data: { tables: mockTables } });
            }
            if (urlStr.includes("/menu")) {
                return Promise.resolve({ data: { items: mockMenuItems } });
            }
            if (urlStr.includes("/orders")) {
                return Promise.resolve({ data: [] });
            }
            if (urlStr.includes("/waitlist")) {
                return Promise.resolve({ data: [] });
            }
            if (urlStr.includes("/reservations")) {
                return Promise.resolve({ data: [] });
            }
            return Promise.resolve({ data: {} });
        });
    });

    it("1. Single submission sends order with clientOperationId and idempotencyKey", async () => {
        let resolveOrderPost;
        const postPromise = new Promise((resolve) => {
            resolveOrderPost = resolve;
        });

        axios.post.mockImplementation((url, payload) => {
            if (url.includes("/orders")) {
                return postPromise;
            }
            return Promise.resolve({ data: { success: true } });
        });

        render(
            <BrowserRouter>
                <Server />
            </BrowserRouter>
        );

        // Wait for tables to render
        await waitFor(() => {
            expect(screen.getByText("Table 1")).toBeInTheDocument();
        });

        // Click on Table 1 to enter ordering mode
        fireEvent.click(screen.getByText("Table 1"));

        // Wait for menu items to appear
        await waitFor(() => {
            expect(screen.getByText("Paneer Tikka")).toBeInTheDocument();
        });

        // Add item to cart
        fireEvent.click(screen.getByText("Paneer Tikka"));

        // Wait for Send KOT button to be enabled
        const sendButtons = screen.getAllByRole("button", { name: /Send KOT/i });
        expect(sendButtons.length).toBeGreaterThan(0);
        const sendBtn = sendButtons[0];
        expect(sendBtn).not.toBeDisabled();

        // Rapid double click on Send KOT
        fireEvent.click(sendBtn);
        fireEvent.click(sendBtn);

        // Verify only 1 POST request was dispatched due to placingOrderRef synchronous guard
        const orderPosts = axios.post.mock.calls.filter(([url]) => url.includes("/orders"));
        expect(orderPosts.length).toBe(1);

        // Verify payload contains clientOperationId and idempotencyKey
        const [targetUrl, payload] = orderPosts[0];
        expect(targetUrl).toContain("/owner/1/orders");
        expect(payload.clientOperationId).toBeDefined();
        expect(typeof payload.clientOperationId).toBe("string");
        expect(payload.clientOperationId.startsWith("srv_ord_")).toBe(true);
        expect(payload.idempotencyKey).toBe(payload.clientOperationId);
        expect(payload.tableNo).toBe("Table 1");
        expect(payload.items.length).toBe(1);

        // Resolve the post promise
        resolveOrderPost({
            data: {
                success: true,
                order: { id: 501, orderNo: "SRV-1001", clientOperationId: payload.clientOperationId },
            },
        });

        await waitFor(() => {
            expect(showToast).toHaveBeenCalledWith(
                expect.objectContaining({ title: expect.stringMatching(/KOT Sent to Kitchen/i) })
            );
        });
    });
});
