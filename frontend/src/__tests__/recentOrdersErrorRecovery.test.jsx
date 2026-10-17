import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Profile from "../pages/Profile";

let mockOrdersResponse = null;
let mockOrdersLoading = false;
let mockOrdersError = null;
let mockRefresh = vi.fn();

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({
        user: null,
        customer: { id: 65, phone: "919999999999" },
        staffToken: null,
        customerToken: "fake_token",
    }),
}));

vi.mock("../hooks/useCustomerProfile", () => ({
    default: () => ({
        profile: {
            name: "Guest",
            phone: "919999999999",
            email: null,
        },
        customerToken: "fake_token",
        loading: false,
        saving: false,
        error: null,
        updateProfile: vi.fn(),
        setError: vi.fn(),
    }),
}));

vi.mock("../hooks/useCachedGet", () => ({
    default: (url, options) => {
        if (url === "/api/wallet") {
            return {
                data: { wallet: { balance: 0, currency: "INR" } },
                loading: false,
                error: null,
                refresh: vi.fn(),
            };
        }
        if (url === "/customer/orders") {
            return {
                data: mockOrdersResponse,
                loading: mockOrdersLoading,
                error: mockOrdersError,
                refresh: mockRefresh,
            };
        }
        return { data: null, loading: false, error: null, refresh: vi.fn() };
    },
}));

describe("RecentOrdersSection Error Recovery Suite", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockOrdersResponse = null;
        mockOrdersLoading = false;
        mockOrdersError = null;
    });

    it("TEST 1: displays error banner and Retry button when API returns 500", () => {
        mockOrdersError = "Failed to fetch customer orders";

        render(
            <MemoryRouter initialEntries={["/profile/overview?scope=customer"]}>
                <Profile section="overview" />
            </MemoryRouter>
        );

        expect(screen.getByText("Failed to fetch customer orders")).toBeInTheDocument();
        const retryBtn = screen.getByRole("button", { name: /retry/i });
        expect(retryBtn).toBeInTheDocument();
        expect(retryBtn).not.toBeDisabled();
    });

    it("TEST 2: clicking Retry triggers refresh and transitions to empty state on success", () => {
        mockOrdersError = "Failed to fetch customer orders";
        mockRefresh.mockImplementation(({ force }) => {
            // Simulate successful retry response
            mockOrdersError = null;
            mockOrdersResponse = { phone: "919999999999", groups: [] };
        });

        const { rerender } = render(
            <MemoryRouter initialEntries={["/profile/overview?scope=customer"]}>
                <Profile section="overview" />
            </MemoryRouter>
        );

        const retryBtn = screen.getByRole("button", { name: /retry/i });
        fireEvent.click(retryBtn);

        expect(mockRefresh).toHaveBeenCalledWith({ force: true });

        // Rerender with the updated state
        rerender(
            <MemoryRouter initialEntries={["/profile/overview?scope=customer"]}>
                <Profile section="overview" />
            </MemoryRouter>
        );

        expect(screen.queryByText("Failed to fetch customer orders")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
        expect(screen.getByText("No recent orders found.")).toBeInTheDocument();
    });

    it("TEST 3: renders orders normally on successful response with groups", () => {
        mockOrdersResponse = {
            phone: "919999999999",
            groups: [
                {
                    restaurant: { name: "Cafe Delight", slug: "cafe-delight" },
                    orders: [
                        {
                            id: 101,
                            orderNo: "ORD-101",
                            createdAt: "2026-10-15T10:00:00Z",
                            status: "PREPARING",
                            tableNo: "Table 5",
                            total: 250,
                        },
                    ],
                },
            ],
        };

        render(
            <MemoryRouter initialEntries={["/profile/overview?scope=customer"]}>
                <Profile section="overview" />
            </MemoryRouter>
        );

        expect(screen.queryByText("Failed to fetch customer orders")).not.toBeInTheDocument();
        expect(screen.getByText("Cafe Delight")).toBeInTheDocument();
        expect(screen.getByText(/Table 5/i)).toBeInTheDocument();
    });

    it("TEST 4: displays empty state 'No recent orders found.' without error banner on groups=[]", () => {
        mockOrdersResponse = {
            phone: "919999999999",
            groups: [],
        };

        render(
            <MemoryRouter initialEntries={["/profile/overview?scope=customer"]}>
                <Profile section="overview" />
            </MemoryRouter>
        );

        expect(screen.queryByText("Failed to fetch customer orders")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
        expect(screen.getByText("No recent orders found.")).toBeInTheDocument();
    });

    it("TEST 5: Retry button is disabled while loading to prevent duplicate simultaneous requests", () => {
        mockOrdersError = "Failed to fetch customer orders";
        mockOrdersLoading = true;

        render(
            <MemoryRouter initialEntries={["/profile/overview?scope=customer"]}>
                <Profile section="overview" />
            </MemoryRouter>
        );

        const retryBtn = screen.getByRole("button", { name: /retrying/i });
        expect(retryBtn).toBeDisabled();
    });
});
