import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CashierStation, { getAuthoritativeTotal } from "../pages/staff/CashierStation";
import axios from "axios";
import * as receiptPrinter from "../utils/receiptPrinter";

// Mock dependencies
const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: "/staff/cashier" }),
    Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
}));

let mockSocketHandlers = {};
let mockIsConnected = true;

vi.mock("../context/StaffSocketContext", () => ({
    useStaffSocket: () => ({
        socket: {
            on: vi.fn((event, cb) => {
                mockSocketHandlers[event] = cb;
            }),
            off: vi.fn((event) => {
                delete mockSocketHandlers[event];
            }),
            emit: vi.fn(),
        },
        isConnected: mockIsConnected,
    }),
}));

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({
        user: { id: 101, name: "Cashier Alice", role: "CASHIER", designation: "Cashier", restaurantId: 1, restaurant: { id: 1, name: "Tiffzy Diner" } },
        token: "fake-jwt-token",
        logout: vi.fn(),
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

const mockShowToast = vi.fn();
vi.mock("../../utils/toast", () => ({
    showToast: (...args) => mockShowToast(...args),
}));
vi.mock("../utils/toast", () => ({
    showToast: (...args) => mockShowToast(...args),
}));

vi.mock("../components/SplitBillingModal", () => ({
    default: ({ isOpen, onClose, onPaymentSettled }) => (
        isOpen ? (
            <div data-testid="split-billing-modal">
                <span>Split Billing Active</span>
                <button onClick={() => { onPaymentSettled?.(); onClose(); }}>Confirm Split Settle</button>
                <button onClick={onClose}>Close Split</button>
            </div>
        ) : null
    ),
}));

vi.mock("axios");

describe("Cashier Station — Comprehensive Production Readiness E2E Audit", () => {
    const mockOrder500 = {
        id: 201,
        orderNo: "ORD-201",
        tableNo: "1",
        tableSessionId: 88,
        status: "DELIVERED",
        paymentStatus: "PENDING",
        orderType: "DINE_IN",
        serverName: "Ramesh",
        createdAt: new Date().toISOString(),
        finalAmount: 500,
        subtotal: 476.19,
        taxAmount: 23.81,
        items: [
            { id: 1, name: "Thali Special", quantity: 2, price: 200, itemTotal: 400 },
            { id: 2, name: "Sweet Lassi", quantity: 2, price: 50, itemTotal: 100 },
        ],
    };

    const mockShift = {
        id: 15,
        status: "OPEN",
        terminalId: "POS-1",
        openingCash: 2000,
        expectedCash: 3500,
        cashMovements: [
            { id: 1, type: "OPENING_CASH", amount: 2000, reason: "Morning Float" },
            { id: 2, type: "CASH_SALE", amount: 1500, reason: "Bill Settlement" },
        ],
        payments: [
            { id: 10, amount: 1500, paymentMethod: "CASH", status: "SUCCESS" },
        ],
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockSocketHandlers = {};
        mockIsConnected = true;

        axios.get.mockImplementation((url) => {
            if (url.includes("/orders/live") || url.includes("/billing/unpaid")) {
                return Promise.resolve({ data: { orders: [mockOrder500] } });
            }
            if (url.includes("/api/shifts/current")) {
                return Promise.resolve({ data: { shift: mockShift } });
            }
            if (url.includes("/api/restaurant/payments")) {
                return Promise.resolve({
                    data: {
                        orders: [
                            {
                                id: 99,
                                orderNo: "ORD-99",
                                invoiceNo: "INV-99",
                                tableNo: "4",
                                total: 750,
                                finalAmount: 750,
                                paymentMode: "UPI",
                                paymentStatus: "SUCCESS",
                                createdAt: new Date().toISOString(),
                                items: [{ id: 1, name: "Dosa", quantity: 3, price: 250 }],
                            },
                        ],
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });

        axios.post.mockResolvedValue({
            data: {
                success: true,
                cleared: true,
                authoritativeTotal: 500,
                payment: { id: 501, amount: 500, status: "SUCCESS" },
                orders: [{ id: 201, status: "DELIVERED", paymentStatus: "SUCCESS" }],
            },
        });
    });

    // 1. Cash Exact Payment E2E
    it("1. Cash exact payment: Bill ₹500, Tender ₹500 -> Paid ₹500, Change ₹0", async () => {
        const printSpy = vi.spyOn(receiptPrinter, "printReceiptWindow").mockReturnValue(true);
        render(<CashierStation />);

        await waitFor(() => {
            expect(screen.getByTestId("order-card-201")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId("order-card-201"));

        // Exact Preset
        const exactBtn = screen.getByText("Exact (₹500)");
        fireEvent.click(exactBtn);

        expect(screen.getByDisplayValue("500")).toBeInTheDocument();
        expect(screen.getByText("₹0.00")).toBeInTheDocument(); // Change is 0

        const settleBtn = screen.getByTestId("settle-payment-btn");
        expect(settleBtn).not.toBeDisabled();
        fireEvent.click(settleBtn);

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("/api/v1/staff/billing/settle"),
                expect.objectContaining({
                    orderId: 201,
                    amount: 500,
                    paymentMethod: "CASH",
                    shiftId: 15,
                }),
                expect.any(Object)
            );
            expect(printSpy).toHaveBeenCalled();
        });
    });

    // 2. Cash Payment with Change E2E
    it("2. Cash payment with change: Bill ₹500, Tender ₹1000 -> Change ₹500", async () => {
        render(<CashierStation />);

        await waitFor(() => {
            expect(screen.getByTestId("order-card-201")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId("order-card-201"));

        // Enter 1000
        const tenderInput = screen.getByPlaceholderText(/e\.g\. 500/i);
        fireEvent.change(tenderInput, { target: { value: "1000" } });

        expect(screen.getByText("₹500.00")).toBeInTheDocument(); // Change to return is 500

        const settleBtn = screen.getByTestId("settle-payment-btn");
        expect(settleBtn).not.toBeDisabled();
        fireEvent.click(settleBtn);

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalled();
        });
    });

    // 3. Insufficient Cash Tender Blocked
    it("3. Insufficient cash: Bill ₹500, Tender ₹400 -> Settlement blocked and button indicates shortage", async () => {
        render(<CashierStation />);

        await waitFor(() => {
            expect(screen.getByTestId("order-card-201")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId("order-card-201"));

        // Enter 400
        const tenderInput = screen.getByPlaceholderText(/e\.g\. 500/i);
        fireEvent.change(tenderInput, { target: { value: "400" } });

        expect(screen.getByText("-₹100.00")).toBeInTheDocument(); // Shortage indicator

        const settleBtn = screen.getByTestId("settle-payment-btn");
        expect(settleBtn).toBeDisabled();
        expect(screen.getByText(/Under-Tendered \(Short ₹100\.00\)/i)).toBeInTheDocument();

        // Attempting to click does not dispatch post
        fireEvent.click(settleBtn);
        expect(axios.post).not.toHaveBeenCalled();
    });

    // 4. UPI Payment Success with Reference UTR
    it("4. UPI payment: allows entering UTR reference and settles with reference ID", async () => {
        render(<CashierStation />);

        await waitFor(() => {
            expect(screen.getByTestId("order-card-201")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId("order-card-201"));

        // Switch to UPI
        fireEvent.click(screen.getByText("UPI / QR"));

        const refInput = screen.getByPlaceholderText(/Enter reference \/ UTR/i);
        fireEvent.change(refInput, { target: { value: "UTR987654321012" } });

        const settleBtn = screen.getByTestId("settle-payment-btn");
        fireEvent.click(settleBtn);

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("/api/v1/staff/billing/settle"),
                expect.objectContaining({
                    orderId: 201,
                    paymentMethod: "UPI",
                    reference: "UTR987654321012",
                }),
                expect.any(Object)
            );
        });
    });

    // 5. UPI Payment Failure
    it("5. UPI payment failure: surfaces backend error and prevents false settlement", async () => {
        axios.post.mockRejectedValueOnce({
            response: { data: { message: "Payment verification failed: invalid UTR" } },
        });

        render(<CashierStation />);

        await waitFor(() => {
            expect(screen.getByTestId("order-card-201")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId("order-card-201"));
        fireEvent.click(screen.getByTestId("pay-method-UPI"));

        const settleBtn = screen.getByTestId("settle-payment-btn");
        fireEvent.click(settleBtn);

        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: "Payment Settlement Error",
                    message: expect.stringContaining("Payment verification failed"),
                    variant: "error",
                })
            );
        });
    });

    // 6. Card / POS Payment Success
    it("6. Card payment: settles with POS terminal reference number", async () => {
        render(<CashierStation />);

        await waitFor(() => {
            expect(screen.getByTestId("order-card-201")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId("order-card-201"));
        fireEvent.click(screen.getByTestId("pay-method-CARD"));

        const refInput = screen.getByPlaceholderText(/Enter reference \/ UTR/i);
        fireEvent.change(refInput, { target: { value: "EDC-TX-8821" } });

        const settleBtn = screen.getByTestId("settle-payment-btn");
        fireEvent.click(settleBtn);

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("/api/v1/staff/billing/settle"),
                expect.objectContaining({
                    orderId: 201,
                    paymentMethod: "CARD",
                    reference: "EDC-TX-8821",
                }),
                expect.any(Object)
            );
        });
    });

    // 7. Split Payment Workflow
    it("7. Split payment: opens SplitBillingModal for table session and triggers settlement", async () => {
        render(<CashierStation />);

        await waitFor(() => {
            expect(screen.getByTestId("order-card-201")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId("order-card-201"));

        // Click Split Bill action
        const splitBtn = screen.getByTestId("open-split-modal-btn");
        fireEvent.click(splitBtn);

        expect(screen.getByTestId("split-billing-modal")).toBeInTheDocument();
        expect(screen.getByText("Split Billing Active")).toBeInTheDocument();

        // Confirm split settle
        fireEvent.click(screen.getByText("Confirm Split Settle"));
        expect(screen.queryByTestId("split-billing-modal")).not.toBeInTheDocument();
    });

    // 8. Duplicate Settlement Prevention
    it("8. Duplicate settlement: in-flight lock disables button while processing", async () => {
        let resolvePost;
        axios.post.mockImplementationOnce(() => new Promise((resolve) => { resolvePost = resolve; }));

        render(<CashierStation />);

        await waitFor(() => {
            expect(screen.getByTestId("order-card-201")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId("order-card-201"));
        fireEvent.click(screen.getByText("Exact (₹500)"));

        const settleBtn = screen.getByTestId("settle-payment-btn");
        fireEvent.click(settleBtn);

        // Immediate in-flight disabled state
        expect(settleBtn).toBeDisabled();
        expect(screen.getByText(/Settling & Releasing Table\.\.\./i)).toBeInTheDocument();

        // Secondary click ignored
        fireEvent.click(settleBtn);
        expect(axios.post).toHaveBeenCalledTimes(1);

        // Resolve request
        resolvePost({ data: { success: true } });
        await waitFor(() => {
            expect(screen.queryByText(/Settling & Releasing Table\.\.\./i)).not.toBeInTheDocument();
        });
    });

    // 9. Cash Drawer Reconciliation Calculation
    it("9. Cash drawer reconciliation: displays float, sales, and expected cash", async () => {
        render(<CashierStation />);

        await waitFor(() => {
            expect(screen.getByTestId("staff-tab-shift")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId("staff-tab-shift"));

        await waitFor(() => {
            expect(screen.getByText("Cash Drawer Shift Management")).toBeInTheDocument();
            expect(screen.getAllByText("₹2000").length).toBeGreaterThanOrEqual(1); // Opening float
            expect(screen.getAllByText("₹3500").length).toBeGreaterThanOrEqual(1); // Expected cash
        });
    });

    // 10. Shift Close with Variance Requires Reason
    it("10. Shift close: blocks submission if discrepancy exists without reason note", async () => {
        render(<CashierStation />);

        await waitFor(() => {
            expect(screen.getByTestId("staff-tab-shift")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId("staff-tab-shift"));

        await waitFor(() => {
            expect(screen.getByTestId("close-shift-btn")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId("close-shift-btn"));

        // Enter mismatched cash (3000 instead of 3500)
        const countedInput = screen.getByPlaceholderText("Enter physical cash count");
        fireEvent.change(countedInput, { target: { value: "3000" } });

        // Expected shortage: -500
        expect(screen.getByText(/Cash Shortage/i)).toBeInTheDocument();

        // Submit close without reason note
        fireEvent.submit(screen.getByTestId("close-shift-form"));

        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({
                title: "Reason Required",
                variant: "error",
            })
        );
        expect(axios.post).not.toHaveBeenCalledWith(expect.stringContaining("/close"), expect.anything(), expect.anything());
    });

    // 11. Cash In Workflow
    it("11. Cash In: opens Cash Movement modal and submits float addition", async () => {
        render(<CashierStation />);

        await waitFor(() => {
            expect(screen.getByTestId("staff-tab-shift")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId("staff-tab-shift"));

        await waitFor(() => {
            expect(screen.getByTestId("shift-cash-in-btn")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId("shift-cash-in-btn"));

        const amountInput = screen.getByPlaceholderText("e.g. 500");
        fireEvent.change(amountInput, { target: { value: "1000" } });

        const reasonInput = screen.getByPlaceholderText(/e\.g\. Petty cash drop/i);
        fireEvent.change(reasonInput, { target: { value: "Change notes addition" } });

        fireEvent.click(screen.getByText("Record Movement"));

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("/api/shifts/15/cash-in"),
                expect.objectContaining({
                    amount: 1000,
                    reason: "Change notes addition",
                }),
                expect.any(Object)
            );
        });
    });

    // 12. Cash Out Workflow
    it("12. Cash Out: opens Cash Movement modal and submits cash drop/payout", async () => {
        render(<CashierStation />);

        await waitFor(() => {
            expect(screen.getByTestId("staff-tab-shift")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId("staff-tab-shift"));

        await waitFor(() => {
            expect(screen.getByTestId("shift-cash-out-btn")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId("shift-cash-out-btn"));

        const amountInput = screen.getByPlaceholderText("e.g. 500");
        fireEvent.change(amountInput, { target: { value: "500" } });

        const reasonInput = screen.getByPlaceholderText(/e\.g\. Petty cash drop/i);
        fireEvent.change(reasonInput, { target: { value: "Manager cash drop" } });

        fireEvent.click(screen.getByText("Record Movement"));

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("/api/shifts/15/cash-out"),
                expect.objectContaining({
                    amount: 500,
                    reason: "Manager cash drop",
                }),
                expect.any(Object)
            );
        });
    });

    // 13. Discount Request Flow with Manager Realtime Approval
    it("13. Discount request: dispatches approval request and handles realtime manager approval", async () => {
        render(<CashierStation />);

        await waitFor(() => {
            expect(screen.getByTestId("order-card-201")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId("order-card-201"));

        // Click Discount button
        const discountBtn = screen.getByTestId("request-discount-btn");
        fireEvent.click(discountBtn);

        const amountInput = screen.getByPlaceholderText("e.g. 100");
        fireEvent.change(amountInput, { target: { value: "50" } });

        const reasonInput = screen.getByPlaceholderText(/e\.g\. VIP guest concession/i);
        fireEvent.change(reasonInput, { target: { value: "Owner Guest" } });

        fireEvent.click(screen.getByText("Send to Manager"));

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("/discount-request"),
                expect.objectContaining({
                    orderId: 201,
                    discountAmount: 50,
                    discountReason: "Owner Guest",
                }),
                expect.any(Object)
            );
        });

        // Simulate manager real-time resolution event over socket
        expect(mockSocketHandlers["manager:approval_resolved"]).toBeDefined();
        mockSocketHandlers["manager:approval_resolved"]({
            orderId: 201,
            discountAmount: 50,
            status: "APPROVED",
        });

        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: "Discount Approved!",
                    variant: "success",
                })
            );
        });
    });

    // 14. Thermal Receipt Reprint from Transaction History
    it("14. Receipt reprint: triggers thermal receipt reprint from transaction history", async () => {
        const printSpy = vi.spyOn(receiptPrinter, "printReceiptWindow").mockReturnValue(true);
        render(<CashierStation />);

        fireEvent.click(screen.getByTestId("staff-tab-transactions"));

        await waitFor(() => {
            expect(screen.getByText(/ORD-99/)).toBeInTheDocument();
        });

        const reprintBtn = screen.getByTestId("reprint-tx-99");
        fireEvent.click(reprintBtn);

        expect(printSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                markup: expect.stringContaining("ORD-99"),
            })
        );
    });

    // 15. Realtime Socket Event Updates Live Bills
    it("15. Realtime synchronization: updates live queue upon order:updated socket event", async () => {
        render(<CashierStation />);

        await waitFor(() => {
            expect(screen.getByTestId("order-card-201")).toBeInTheDocument();
        });

        // Trigger order:updated
        expect(mockSocketHandlers["order:updated"]).toBeDefined();
        mockSocketHandlers["order:updated"]({ id: 202 });

        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledWith(
                expect.stringContaining("/orders/live"),
                expect.any(Object)
            );
        });
    });

    // 16. Offline / Reconnect Behavior
    it("16. Offline behavior: disables settle button and alerts cashier when offline", async () => {
        mockIsConnected = false;
        render(<CashierStation />);

        await waitFor(() => {
            expect(screen.getByTestId("order-card-201")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId("order-card-201"));

        const settleBtn = screen.getByTestId("settle-payment-btn");
        expect(settleBtn).toBeDisabled();
        expect(screen.getByText(/Offline — Settlements Paused/i)).toBeInTheDocument();

        fireEvent.click(settleBtn);
        expect(axios.post).not.toHaveBeenCalled();
    });
});
