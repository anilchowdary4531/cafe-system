import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import CashierStation, { getAuthoritativeTotal } from "../pages/staff/CashierStation";
import axios from "axios";
import * as receiptPrinter from "../utils/receiptPrinter";

// Mocks
vi.mock("axios");
vi.mock("../../context/AuthContext", () => ({
    useAuth: () => ({
        user: { id: 101, name: "Cashier Alice", role: "CASHIER", designation: "Cashier", restaurantId: 1, restaurant: { id: 1, name: "Tiffzy Diner" } },
        token: "fake-jwt-token",
        logout: vi.fn(),
    }),
}));
vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({
        user: { id: 101, name: "Cashier Alice", role: "CASHIER", designation: "Cashier", restaurantId: 1, restaurant: { id: 1, name: "Tiffzy Diner" } },
        token: "fake-jwt-token",
        logout: vi.fn(),
    }),
}));

const mockSocket = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
};
vi.mock("../../context/StaffSocketContext", () => ({
    useStaffSocket: () => ({
        socket: mockSocket,
        isConnected: true,
    }),
}));
vi.mock("../context/StaffSocketContext", () => ({
    useStaffSocket: () => ({
        socket: mockSocket,
        isConnected: true,
    }),
}));

const mockTables = [
    { id: 1, tableNo: "1", canonicalStatus: "AVAILABLE", isOccupied: false },
    { id: 2, tableNo: "2", canonicalStatus: "OCCUPIED", isOccupied: true, sessionTotal: 450 },
    { id: 3, tableNo: "3", canonicalStatus: "BILLING", isOccupied: true, sessionTotal: 840 },
];
vi.mock("../../context/TableStateContext", () => ({
    useCanonicalTables: () => ({
        tables: mockTables,
        occupiedCount: 2,
        freeCount: 1,
        totalCount: 3,
        loading: false,
        refreshTables: vi.fn().mockResolvedValue([]),
    }),
}));
vi.mock("../context/TableStateContext", () => ({
    useCanonicalTables: () => ({
        tables: mockTables,
        occupiedCount: 2,
        freeCount: 1,
        totalCount: 3,
        loading: false,
        refreshTables: vi.fn().mockResolvedValue([]),
    }),
}));

vi.mock("../../utils/soundPlayer", () => ({
    playNotificationSound: vi.fn(),
    triggerNotificationVibration: vi.fn(),
}));
vi.mock("../utils/soundPlayer", () => ({
    playNotificationSound: vi.fn(),
    triggerNotificationVibration: vi.fn(),
}));

vi.mock("../../utils/toast", () => ({
    showToast: vi.fn(),
}));
vi.mock("../utils/toast", () => ({
    showToast: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: "/staff/cashier" }),
    Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
}));

describe("CashierStation — POS Workstation Redesign", () => {
    const mockOrders = [
        {
            id: 101,
            orderNo: "101",
            tableNo: "3",
            orderType: "DINE_IN",
            status: "BILL_REQUESTED",
            billRequested: true,
            paymentStatus: "PENDING",
            subtotal: 800,
            taxAmount: 40,
            serviceChargeAmount: 0,
            discountAmount: 0,
            total: 840,
            customer: { name: "John Doe", phone: "9876543210" },
            serverName: "Waiter Bob",
            items: [
                { id: 1, name: "Chicken Biryani", price: 350, qty: 2 },
                { id: 2, name: "Masala Chai", price: 70, qty: 2 },
            ],
        },
        {
            id: 102,
            orderNo: "102",
            tableNo: "",
            orderType: "TAKEAWAY",
            status: "PLACED",
            paymentStatus: "PENDING",
            total: 250,
            customer: { name: "Sarah Smith", phone: "9123456780" },
            items: [{ id: 3, name: "Paneer Roll", price: 250, qty: 1 }],
        },
    ];

    const mockShift = {
        id: 7,
        restaurantId: 1,
        userId: 101,
        status: "OPEN",
        terminalId: "MAIN",
        openingCash: 2000,
        expectedCash: 2840,
        openedAt: new Date(Date.now() - 3600000).toISOString(),
        cashMovements: [
            { id: 1, type: "OPENING_CASH", amount: 2000, reason: "Initial float", createdAt: new Date().toISOString() },
            { id: 2, type: "CASH_SALE", amount: 840, reason: "Bill #99", createdAt: new Date().toISOString() },
        ],
    };

    const mockPayments = [
        {
            id: 50,
            orderNo: "99",
            customerName: "Alice Walker",
            phone: "9998887776",
            paymentMode: "CASH",
            total: 840,
            paymentStatus: "SUCCESS",
            createdAt: new Date().toISOString(),
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        axios.get.mockImplementation((url) => {
            if (url.includes("/orders/live")) {
                return Promise.resolve({ data: { orders: mockOrders } });
            }
            if (url.includes("/api/shifts/current")) {
                return Promise.resolve({ data: { shift: mockShift } });
            }
            if (url.includes("/api/restaurant/payments")) {
                return Promise.resolve({ data: { orders: mockPayments } });
            }
            return Promise.resolve({ data: {} });
        });
        axios.post.mockResolvedValue({ data: { success: true, authoritativeTotal: 840 } });
    });

    it("1. computes authoritative total correctly under all schemas", () => {
        expect(getAuthoritativeTotal({ total: 500 })).toBe(500);
        expect(getAuthoritativeTotal({ finalAmount: 420 })).toBe(420);
        expect(getAuthoritativeTotal({ tableSession: { total: 750 } })).toBe(750);
        expect(
            getAuthoritativeTotal({
                items: [{ price: 100, qty: 2 }, { price: 50, qty: 1 }],
                taxAmount: 25,
                serviceChargeAmount: 10,
                discountAmount: 15,
            })
        ).toBe(270);
    });

    it("2. renders top bar with online status, drawer float, and active bills counter", async () => {
        render(<CashierStation />);

        await waitFor(() => {
            expect(screen.getByText(/ONLINE • REALTIME POS/i)).toBeInTheDocument();
        });

        expect(screen.getByText(/Unpaid Bills:/i)).toBeInTheDocument();
        expect(screen.getByText(/DRAWER OPEN/i)).toBeInTheDocument();
        expect(screen.getAllByText("₹2840").length).toBeGreaterThanOrEqual(1);
    });

    it("3. displays table status strip with interactive table chips", async () => {
        render(<CashierStation />);

        await waitFor(() => {
            expect(screen.getByText("T-1")).toBeInTheDocument();
            expect(screen.getByText("T-2")).toBeInTheDocument();
            expect(screen.getByText("T-3")).toBeInTheDocument();
        });
    });

    it("4. loads unpaid bills queue and allows selecting an order", async () => {
        render(<CashierStation />);

        await waitFor(() => {
            expect(screen.getByText(/Bill #101/i)).toBeInTheDocument();
            expect(screen.getByText(/Takeaway #102/i)).toBeInTheDocument();
        });

        // Click Table 3 bill
        fireEvent.click(screen.getByTestId("order-card-101"));

        // Details pane should now display Bill #101 items and total
        await waitFor(() => {
            expect(screen.getByText("Total Authoritative Due")).toBeInTheDocument();
            expect(screen.getByTestId("authoritative-grand-total")).toHaveTextContent("₹840");
            expect(screen.getByText("Chicken Biryani")).toBeInTheDocument();
            expect(screen.getByText("Masala Chai")).toBeInTheDocument();
        });
    });

    it("5. cash change calculator calculates change and presets work seamlessly", async () => {
        render(<CashierStation />);

        await waitFor(() => {
            expect(screen.getByTestId("order-card-101")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId("order-card-101"));

        await waitFor(() => {
            expect(screen.getByText("Fast Cash Presets")).toBeInTheDocument();
        });

        // Click exact preset
        const exactBtn = screen.getByText("Exact (₹840)");
        fireEvent.click(exactBtn);

        expect(screen.getByDisplayValue("840")).toBeInTheDocument();
        expect(screen.getByText("₹0.00")).toBeInTheDocument();

        // Click +100 preset (840 + 100 = 940)
        const plus100Btn = screen.getByText("+₹100 (₹940)");
        fireEvent.click(plus100Btn);

        expect(screen.getByDisplayValue("940")).toBeInTheDocument();
        expect(screen.getByText("₹100.00")).toBeInTheDocument(); // Change is 100
    });

    it("6. settles cash payment via authoritative endpoint and triggers thermal receipt print", async () => {
        const printSpy = vi.spyOn(receiptPrinter, "printReceiptWindow").mockReturnValue(true);

        render(<CashierStation />);

        await waitFor(() => {
            expect(screen.getByTestId("order-card-101")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId("order-card-101"));

        // Enter exact cash
        const exactBtn = screen.getByText("Exact (₹840)");
        fireEvent.click(exactBtn);

        const settleBtn = await screen.findByTestId("settle-payment-btn");
        fireEvent.click(settleBtn);

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("/api/v1/staff/billing/settle"),
                expect.objectContaining({
                    orderId: 101,
                    amount: 840,
                    paymentMethod: "CASH",
                    shiftId: 7,
                }),
                expect.any(Object)
            );
            expect(printSpy).toHaveBeenCalled();
        });
    });

    it("7. switches to Cash Drawer view and displays reconciliation metrics", async () => {
        render(<CashierStation />);

        await waitFor(() => {
            expect(screen.getByTestId("staff-tab-shift")).toBeInTheDocument();
        });

        // Switch to shift tab
        fireEvent.click(screen.getByTestId("staff-tab-shift"));

        await waitFor(() => {
            expect(screen.getByText("Cash Drawer Shift Management")).toBeInTheDocument();
            expect(screen.getByText("Authoritative Expected Cash In Drawer")).toBeInTheDocument();
            expect(screen.getByText("Cash Movement Audit Trail (2)")).toBeInTheDocument();
        });
    });

    it("8. switches to Transactions tab and displays settled history", async () => {
        render(<CashierStation />);

        await waitFor(() => {
            expect(screen.getByTestId("staff-tab-transactions")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId("staff-tab-transactions"));

        await waitFor(() => {
            expect(screen.getByText(/Recent Settle Transactions/i)).toBeInTheDocument();
            expect(screen.getByText("Alice Walker")).toBeInTheDocument();
            expect(screen.getByText("Reprint")).toBeInTheDocument();
        });
    });
});
