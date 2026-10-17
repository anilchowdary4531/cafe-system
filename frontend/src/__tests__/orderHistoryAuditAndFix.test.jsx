import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import OrderHistory from "../pages/OrderHistory";
import * as apiClient from "../utils/apiClient";

let mockOrdersData = null;
let mockLoading = false;
let mockError = "";
let mockRefresh = vi.fn();

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({
        user: null,
        customer: { id: 65, phone: "919999999999" },
        customerToken: "fake_customer_token",
    }),
}));

vi.mock("../context/RestaurantContext", () => ({
    useRestaurantContext: () => ({
        restaurantContext: { slug: "cafe-delight" },
        setRestaurantContext: vi.fn(),
    }),
}));

vi.mock("../context/CartContext", () => ({
    useCart: () => ({
        addToCart: vi.fn(),
    }),
}));

vi.mock("../hooks/useCachedGet", () => ({
    default: (url, options) => {
        if (url === "/customer/orders") {
            return {
                data: mockOrdersData,
                loading: mockLoading,
                error: mockError,
                refresh: mockRefresh,
            };
        }
        return { data: null, loading: false, error: "", refresh: vi.fn() };
    },
}));

describe("OrderHistory 6 Scenarios Test Suite", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockOrdersData = null;
        mockLoading = false;
        mockError = "";
    });

    it("TEST 1: Backend returns 200 + groups: [] -> No error banner, empty orders state displayed", () => {
        mockOrdersData = {
            phone: "919999999999",
            groups: [],
        };

        render(
            <MemoryRouter initialEntries={["/profile/order-history?scope=customer"]}>
                <OrderHistory />
            </MemoryRouter>
        );

        expect(screen.queryByText(/failed to fetch customer orders/i)).not.toBeInTheDocument();
        expect(screen.getByText("No active orders")).toBeInTheDocument();
        expect(screen.getByText("No previous orders")).toBeInTheDocument();
    });

    it("TEST 2: Backend returns 200 + groups containing orders -> Orders displayed", () => {
        mockOrdersData = {
            phone: "919999999999",
            groups: [
                {
                    restaurant: { name: "Cafe Delight", slug: "cafe-delight" },
                    orders: [
                        {
                            id: 201,
                            orderNo: "ORD-201",
                            createdAt: "2026-10-16T12:00:00Z",
                            status: "PREPARING",
                            tableNo: "Table 4",
                            total: 350,
                            items: [{ itemName: "Paneer Tikka", qty: 2, price: 175 }],
                        },
                    ],
                },
            ],
        };

        render(
            <MemoryRouter initialEntries={["/profile/order-history?scope=customer"]}>
                <OrderHistory />
            </MemoryRouter>
        );

        expect(screen.queryByText(/failed to fetch customer orders/i)).not.toBeInTheDocument();
        expect(screen.getByText(/ORD-201/i)).toBeInTheDocument();
        expect(screen.getAllByText("Cafe Delight").length).toBeGreaterThan(0);
    });

    it("TEST 3: Backend returns 500 -> 'Failed to fetch customer orders' displayed with Retry button", () => {
        mockError = "Failed to fetch customer orders";

        render(
            <MemoryRouter initialEntries={["/profile/order-history?scope=customer"]}>
                <OrderHistory />
            </MemoryRouter>
        );

        expect(screen.getByText("Failed to fetch customer orders")).toBeInTheDocument();
        const retryBtn = screen.getByRole("button", { name: /retry/i });
        expect(retryBtn).toBeInTheDocument();
        expect(retryBtn).not.toBeDisabled();
    });

    it("TEST 4: First request fails with 500. Click Retry. Second request returns 200 -> Error disappears and empty state is displayed", () => {
        mockError = "Failed to fetch customer orders";
        mockRefresh.mockImplementation(({ force }) => {
            mockError = "";
            mockOrdersData = { phone: "919999999999", groups: [] };
        });

        const { rerender } = render(
            <MemoryRouter initialEntries={["/profile/order-history?scope=customer"]}>
                <OrderHistory />
            </MemoryRouter>
        );

        const retryBtn = screen.getByRole("button", { name: /retry/i });
        fireEvent.click(retryBtn);

        expect(mockRefresh).toHaveBeenCalledWith({ force: true });

        rerender(
            <MemoryRouter initialEntries={["/profile/order-history?scope=customer"]}>
                <OrderHistory />
            </MemoryRouter>
        );

        expect(screen.queryByText("Failed to fetch customer orders")).not.toBeInTheDocument();
        expect(screen.getByText("No active orders")).toBeInTheDocument();
        expect(screen.getByText("No previous orders")).toBeInTheDocument();
    });

    it("TEST 5: Page refresh does not retain stale error from a previous request when cache is clean or refreshed", () => {
        mockError = "";
        mockOrdersData = { phone: "919999999999", groups: [] };

        render(
            <MemoryRouter initialEntries={["/profile/order-history?scope=customer"]}>
                <OrderHistory />
            </MemoryRouter>
        );

        expect(screen.queryByText(/failed to fetch customer orders/i)).not.toBeInTheDocument();
        expect(screen.getByText("No active orders")).toBeInTheDocument();
    });
});
