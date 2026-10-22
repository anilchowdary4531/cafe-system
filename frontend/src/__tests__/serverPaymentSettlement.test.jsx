import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TablePaymentSettlementModal from "../components/TablePaymentSettlementModal";
import Server, { resolveTableActiveOrderStatus, isTablePaymentPending } from "../pages/Server";
import { LanguageProvider } from "../context/LanguageContext";
import { RestaurantThemeProvider } from "../context/ThemeContext";
import { RestaurantContextProvider } from "../context/RestaurantContext";
import { CartProvider } from "../context/CartContext";
import { api } from "../utils/apiClient";
import * as receiptPrinter from "../utils/receiptPrinter";

const mockTablesForServer = [
    {
        id: 1,
        tableNo: "1",
        seats: 2,
        isOccupied: false,
        isBlocked: false,
        section: "Main Floor",
        activeOrders: [],
    },
    {
        id: 3,
        tableNo: "3",
        seats: 2,
        isOccupied: true,
        isBlocked: false,
        section: "Main Floor",
        assignedWaiterName: "kamalesh",
        activeOrderCount: 1,
        activeOrders: [
            {
                id: 101,
                orderNo: "ORD-101",
                status: "DELIVERED",
                paymentStatus: "PENDING",
                total: 1250,
                items: [
                    { itemName: "Butter Chicken", qty: 2, price: 500, total: 1000 },
                    { itemName: "Garlic Naan", qty: 5, price: 50, total: 250 },
                ],
            },
        ],
    },
];

vi.mock("../hooks/useCachedGet", () => ({
    default: (url) => {
        const urlStr = String(url || "");
        if (urlStr.includes("/tables")) {
            return { data: { tables: mockTablesForServer }, loading: false, refresh: vi.fn() };
        }
        if (urlStr.includes("/menu")) {
            return { data: { items: [] }, loading: false, refresh: vi.fn() };
        }
        if (urlStr.includes("/reservations")) {
            return { data: { reservations: [] }, loading: false, refresh: vi.fn() };
        }
        if (urlStr.includes("/kots")) {
            return { data: { kots: [] }, loading: false, refresh: vi.fn() };
        }
        if (urlStr.includes("/orders")) {
            return { data: { orders: [] }, loading: false, refresh: vi.fn() };
        }
        return { data: null, loading: false, refresh: vi.fn() };
    },
}));

vi.mock("axios", () => {
    const mockAxiosInstance = {
        get: vi.fn(),
        post: vi.fn().mockResolvedValue({ data: { success: true } }),
        put: vi.fn().mockResolvedValue({ data: { success: true } }),
        delete: vi.fn().mockResolvedValue({ data: { success: true } }),
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
        user: { id: 1, restaurantId: 4, name: "kamalesh", role: "SERVER", restaurant: { name: "Tiffzy Cafe" } },
        logout: vi.fn(),
    }),
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

vi.mock("../utils/apiClient", () => ({
    api: {
        post: vi.fn(),
        get: vi.fn(),
    },
}));

describe("Tiffzy Server Station — Cash/UPI Payment Settlement & Bill Printing", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const mockPendingTable = {
        id: 3,
        tableNo: "3",
        isOccupied: true,
        isBlocked: false,
        assignedWaiterName: "kamalesh",
        activeOrderCount: 1,
        activeOrders: [
            {
                id: 101,
                orderNo: "ORD-101",
                status: "DELIVERED",
                paymentStatus: "PENDING",
                total: 1250,
                items: [
                    { itemName: "Butter Chicken", qty: 2, price: 500, total: 1000 },
                    { itemName: "Garlic Naan", qty: 5, price: 50, total: 250 },
                ],
            },
        ],
    };

    const mockAvailableTable = {
        id: 1,
        tableNo: "1",
        isOccupied: false,
        isBlocked: false,
        activeOrders: [],
    };

    const mockReservedTable = {
        id: 2,
        tableNo: "2",
        isOccupied: false,
        isReserved: true,
        activeOrders: [],
    };

    const mockBlockedTable = {
        id: 4,
        tableNo: "4",
        isOccupied: true,
        isBlocked: true,
        blockReason: "Maintenance",
        activeOrders: [],
    };

    const mockPaidTable = {
        id: 5,
        tableNo: "5",
        isOccupied: true,
        activeOrders: [
            {
                id: 105,
                status: "DELIVERED",
                paymentStatus: "PAID",
                total: 800,
            },
        ],
    };

    describe("Phase 2 & 6: Order Status and Settle Button Visibility Rules", () => {
        it("A: resolves PAYMENT_PENDING when all active orders are DELIVERED and unpaid", () => {
            const status = resolveTableActiveOrderStatus(mockPendingTable);
            expect(status).toBe("PAYMENT_PENDING");
        });

        it("B: does not resolve PAYMENT_PENDING for AVAILABLE table", () => {
            const status = resolveTableActiveOrderStatus(mockAvailableTable);
            expect(status).toBeNull();
        });

        it("does not resolve PAYMENT_PENDING for already paid table", () => {
            const status = resolveTableActiveOrderStatus(mockPaidTable);
            expect(status).toBe("PAID");
        });
    });

    describe("Phase 3 & 4: Modal UI and Authoritative Bill Amount", () => {
        it("C & D: displays Table 3, Server kamalesh, and authoritative bill amount ₹1,250.00", () => {
            render(
                <TablePaymentSettlementModal
                    isOpen={true}
                    onClose={vi.fn()}
                    table={mockPendingTable}
                    restaurantId={4}
                    serverName="kamalesh"
                />
            );

            expect(screen.getByTestId("settle-payment-modal")).toBeInTheDocument();
            expect(screen.getByText("Settle Payment")).toBeInTheDocument();
            expect(screen.getByText("3")).toBeInTheDocument();
            expect(screen.getByText("kamalesh")).toBeInTheDocument();
            expect(screen.getByTestId("modal-bill-amount")).toHaveTextContent("₹1250.00");
        });

        it("E, F, G: allows selecting CASH and UPI, with only one selected at a time", () => {
            render(
                <TablePaymentSettlementModal
                    isOpen={true}
                    onClose={vi.fn()}
                    table={mockPendingTable}
                    restaurantId={4}
                    serverName="kamalesh"
                />
            );

            const cashBtn = screen.getByTestId("payment-method-cash");
            const upiBtn = screen.getByTestId("payment-method-upi");
            const confirmBtn = screen.getByTestId("confirm-payment-btn");

            // Initially Confirm is disabled because nothing is selected
            expect(confirmBtn).toBeDisabled();

            // Select CASH
            fireEvent.click(cashBtn);
            expect(screen.getByText("Confirm Payment (CASH)")).not.toBeDisabled();
            expect(screen.getByText(/✓ Selected/i)).toBeInTheDocument();

            // Select UPI
            fireEvent.click(upiBtn);
            expect(screen.getByText("Confirm Payment (UPI)")).not.toBeDisabled();
            // UPI details section should now be visible
            expect(screen.getByTestId("upi-details-section")).toBeInTheDocument();
            expect(screen.getByTestId("upi-reference-input")).toBeInTheDocument();
        });
    });

    describe("Phase 4, 7, 10: Cash Settlement Execution and Duplicate Protection", () => {
        it("H, I, J, K, L: confirms Cash settlement and transitions to Success screen", async () => {
            api.post.mockResolvedValueOnce({
                data: {
                    cleared: true,
                    message: "Table 3 bill settled",
                    orders: [
                        {
                            id: 101,
                            status: "DELIVERED",
                            paymentStatus: "SUCCESS",
                            total: 1250,
                            items: mockPendingTable.activeOrders[0].items,
                        },
                    ],
                    paymentMode: "CASH",
                    restaurant: { name: "Cafe King", address: "123 Main St", phone: "9876543210" },
                },
            });

            const handleSettled = vi.fn();
            render(
                <TablePaymentSettlementModal
                    isOpen={true}
                    onClose={vi.fn()}
                    table={mockPendingTable}
                    restaurantId={4}
                    serverName="kamalesh"
                    onSettled={handleSettled}
                />
            );

            // Select CASH
            fireEvent.click(screen.getByTestId("payment-method-cash"));

            // Click Confirm
            fireEvent.click(screen.getByTestId("confirm-payment-btn"));

            // Verify API call sent authoritative amount and changedByName
            expect(api.post).toHaveBeenCalledWith(
                "/owner/4/tables/3/settle-bill",
                expect.objectContaining({
                    tableId: 3,
                    paymentMode: "CASH",
                    changedByName: "kamalesh",
                    amount: 1250,
                })
            );

            // Wait for success view
            await waitFor(() => {
                expect(screen.getByTestId("settlement-success-view")).toBeInTheDocument();
            });

            expect(screen.getByText(/✓ Payment Successful/i)).toBeInTheDocument();
            expect(screen.getByTestId("print-bill-btn")).toBeInTheDocument();
            expect(screen.getByTestId("settlement-done-btn")).toBeInTheDocument();
            expect(handleSettled).toHaveBeenCalledTimes(1);
        });

        it("N & O: handles double-click and prevents duplicate settlements", async () => {
            let resolveApi;
            api.post.mockImplementationOnce(
                () =>
                    new Promise((resolve) => {
                        resolveApi = resolve;
                    })
            );

            render(
                <TablePaymentSettlementModal
                    isOpen={true}
                    onClose={vi.fn()}
                    table={mockPendingTable}
                    restaurantId={4}
                    serverName="kamalesh"
                />
            );

            // Select CASH
            fireEvent.click(screen.getByTestId("payment-method-cash"));

            const confirmBtn = screen.getByTestId("confirm-payment-btn");
            fireEvent.click(confirmBtn);

            // During submission, button must be disabled with spinner
            expect(confirmBtn).toBeDisabled();
            expect(screen.getByText(/Settling Payment.../i)).toBeInTheDocument();

            // Clicking again must not fire another post
            fireEvent.click(confirmBtn);
            expect(api.post).toHaveBeenCalledTimes(1);

            // Finish resolution
            resolveApi({
                data: {
                    cleared: true,
                    orders: mockPendingTable.activeOrders,
                    paymentMode: "CASH",
                },
            });

            await waitFor(() => {
                expect(screen.getByTestId("settlement-success-view")).toBeInTheDocument();
            });
        });
    });

    describe("Phase 5: UPI Settlement with Reference & QR", () => {
        it("F: supports UPI collection with optional reference number", async () => {
            api.post.mockResolvedValueOnce({
                data: {
                    cleared: true,
                    message: "Table 3 bill settled",
                    orders: mockPendingTable.activeOrders,
                    paymentMode: "UPI",
                },
            });

            render(
                <TablePaymentSettlementModal
                    isOpen={true}
                    onClose={vi.fn()}
                    table={mockPendingTable}
                    restaurantId={4}
                    serverName="kamalesh"
                    restaurantInfo={{ upiId: "cafeking@upi", name: "Cafe King" }}
                />
            );

            // Select UPI
            fireEvent.click(screen.getByTestId("payment-method-upi"));

            // Enter reference
            const refInput = screen.getByTestId("upi-reference-input");
            fireEvent.change(refInput, { target: { value: "UPI-TXN-987654" } });

            // Confirm
            fireEvent.click(screen.getByTestId("confirm-payment-btn"));

            expect(api.post).toHaveBeenCalledWith(
                "/owner/4/tables/3/settle-bill",
                expect.objectContaining({
                    tableId: 3,
                    paymentMode: "UPI",
                    reference: "UPI-TXN-987654",
                    amount: 1250,
                })
            );

            await waitFor(() => {
                expect(screen.getByTestId("settlement-success-view")).toBeInTheDocument();
            });
            expect(screen.getByText("UPI-TXN-987654")).toBeInTheDocument();
        });
    });

    describe("Phase 11 & 12: Bill Printing", () => {
        it("R & S: triggers printReceiptWindow with authoritative table and order information", async () => {
            const printSpy = vi.spyOn(receiptPrinter, "printReceiptWindow").mockReturnValue(true);

            api.post.mockResolvedValueOnce({
                data: {
                    cleared: true,
                    orders: mockPendingTable.activeOrders,
                    paymentMode: "CASH",
                    restaurant: { name: "Cafe King", address: "Station Road", phone: "9876543210" },
                },
            });

            render(
                <TablePaymentSettlementModal
                    isOpen={true}
                    onClose={vi.fn()}
                    table={mockPendingTable}
                    restaurantId={4}
                    serverName="kamalesh"
                />
            );

            fireEvent.click(screen.getByTestId("payment-method-cash"));
            fireEvent.click(screen.getByTestId("confirm-payment-btn"));

            await waitFor(() => {
                expect(screen.getByTestId("print-bill-btn")).toBeInTheDocument();
            });

            // Click Print Bill
            fireEvent.click(screen.getByTestId("print-bill-btn"));

            expect(printSpy).toHaveBeenCalled();
            const calledArg = printSpy.mock.calls[0][0];
            expect(calledArg.markup).toContain("Table 3");
            expect(calledArg.markup).toContain("Butter Chicken");
            expect(calledArg.markup).toContain("Garlic Naan");
            expect(calledArg.markup).toContain("₹1250.00");
            expect(calledArg.markup).toContain("CASH");
            expect(calledArg.markup).toContain("PAID");

            printSpy.mockRestore();
        });
    });

    describe("Server Station Table Card Settle Payment Button Visibility & User Flow", () => {
        it("1 & 2: PAYMENT_PENDING table shows Settle Payment button, AVAILABLE table does not", async () => {
            render(
                <MemoryRouter initialEntries={["/server"]}>
                    <LanguageProvider>
                        <RestaurantThemeProvider>
                            <RestaurantContextProvider>
                                <CartProvider>
                                    <Server />
                                </CartProvider>
                            </RestaurantContextProvider>
                        </RestaurantThemeProvider>
                    </LanguageProvider>
                </MemoryRouter>
            );

            // Table 3 is PAYMENT_PENDING -> Settle Payment button must be visible directly on table 3 card
            expect(screen.getByTestId("settle-payment-btn-3")).toBeInTheDocument();
            expect(screen.getByTestId("settle-payment-btn-3")).toHaveTextContent("💳 Settle Payment");

            // Table 1 is AVAILABLE -> No settle payment button
            expect(screen.queryByTestId("settle-payment-btn-1")).toBeNull();
        });

        it("3: Clicking Settle Payment directly on Table 3 card opens the payment modal", async () => {
            render(
                <MemoryRouter initialEntries={["/server"]}>
                    <LanguageProvider>
                        <RestaurantThemeProvider>
                            <RestaurantContextProvider>
                                <CartProvider>
                                    <Server />
                                </CartProvider>
                            </RestaurantContextProvider>
                        </RestaurantThemeProvider>
                    </LanguageProvider>
                </MemoryRouter>
            );

            const settleBtn = screen.getByTestId("settle-payment-btn-3");
            fireEvent.click(settleBtn);

            await waitFor(() => {
                expect(screen.getByTestId("settle-payment-modal")).toBeInTheDocument();
            });
            expect(screen.getByTestId("modal-bill-amount")).toHaveTextContent("₹1250.00");
        });

        it("isTablePaymentPending correctly identifies payment pending condition across diverse table states", () => {
            expect(isTablePaymentPending(mockPendingTable)).toBe(true);
            expect(isTablePaymentPending(mockAvailableTable)).toBe(false);
            expect(isTablePaymentPending(mockReservedTable)).toBe(false);
            expect(isTablePaymentPending(mockBlockedTable)).toBe(false);
            expect(isTablePaymentPending(mockPaidTable)).toBe(false);
            expect(isTablePaymentPending({ status: "PAYMENT_PENDING" })).toBe(true);
            expect(isTablePaymentPending({ orderStatus: "PAYMENT_PENDING" })).toBe(true);
            expect(isTablePaymentPending({ activeSession: { status: "BILLING" } })).toBe(true);
        });
    });

    describe("Regression: Table 2 ₹672 Authoritative Amount and Zero-Value Settlement Protection", () => {
        const mockTable2Stale = {
            id: 2,
            tableNo: "2",
            isOccupied: true,
            isBlocked: false,
            assignedWaiterName: "kamalesh",
            activeOrderCount: 0,
            activeOrders: [], // Empty/stale active orders
            total: 0,
        };

        it("displays 'Loading bill amount...' instead of ₹0.00 while authoritative bill is fetching, then renders ₹672.00", async () => {
            let resolveBillPromise;
            api.get.mockImplementationOnce(
                () =>
                    new Promise((resolve) => {
                        resolveBillPromise = resolve;
                    })
            );

            render(
                <TablePaymentSettlementModal
                    isOpen={true}
                    onClose={vi.fn()}
                    table={mockTable2Stale}
                    restaurantId={4}
                    serverName="kamalesh"
                />
            );

            // Modal should display "Loading bill amount...", NOT "₹0.00"
            expect(screen.getByTestId("modal-bill-amount")).toHaveTextContent("Loading bill amount...");
            expect(screen.getByTestId("confirm-payment-btn")).toBeDisabled();

            // Resolve authoritative bill from backend
            resolveBillPromise({
                data: {
                    tableNo: "2",
                    authoritativeTotal: 672,
                    total: 672,
                    orders: [
                        {
                            id: 201,
                            orderNo: "ORD-TABLE2",
                            total: 672,
                            status: "DELIVERED",
                            paymentStatus: "PENDING",
                        },
                    ],
                },
            });

            // Once resolved, bill amount updates to ₹672.00
            await waitFor(() => {
                expect(screen.getByTestId("modal-bill-amount")).toHaveTextContent("₹672.00");
            });

            // Confirm button is enabled once payment method is selected
            fireEvent.click(screen.getByTestId("payment-method-cash"));
            expect(screen.getByTestId("confirm-payment-btn")).not.toBeDisabled();
            expect(screen.getByTestId("cash-details-section")).toHaveTextContent("₹672.00");
        });

        it("submits the backend authoritative total ₹672.00 and NOT ₹0.00 during Cash settlement", async () => {
            api.get.mockResolvedValueOnce({
                data: {
                    tableNo: "2",
                    authoritativeTotal: 672,
                    total: 672,
                    orders: [{ id: 201, orderNo: "ORD-TABLE2", total: 672 }],
                },
            });

            api.post.mockResolvedValueOnce({
                data: {
                    cleared: true,
                    message: "Table 2 bill settled",
                    orders: [{ id: 201, status: "DELIVERED", paymentStatus: "SUCCESS", total: 672 }],
                    paymentMode: "CASH",
                },
            });

            render(
                <TablePaymentSettlementModal
                    isOpen={true}
                    onClose={vi.fn()}
                    table={mockTable2Stale}
                    restaurantId={4}
                    serverName="kamalesh"
                />
            );

            await waitFor(() => {
                expect(screen.getByTestId("modal-bill-amount")).toHaveTextContent("₹672.00");
            });

            fireEvent.click(screen.getByTestId("payment-method-cash"));
            fireEvent.click(screen.getByTestId("confirm-payment-btn"));

            // Verify the API payload sent amount: 672, NEVER 0
            expect(api.post).toHaveBeenCalledWith(
                "/owner/4/tables/2/settle-bill",
                expect.objectContaining({
                    tableId: 2,
                    paymentMode: "CASH",
                    amount: 672,
                })
            );

            await waitFor(() => {
                expect(screen.getByTestId("settlement-success-view")).toBeInTheDocument();
            });
        });

        it("blocks payment confirmation and prevents zero-value settlement if bill amount cannot be resolved", async () => {
            api.get.mockResolvedValueOnce({
                data: {
                    tableNo: "2",
                    authoritativeTotal: 0,
                    total: 0,
                    orders: [],
                },
            });

            render(
                <TablePaymentSettlementModal
                    isOpen={true}
                    onClose={vi.fn()}
                    table={mockTable2Stale}
                    restaurantId={4}
                    serverName="kamalesh"
                />
            );

            await waitFor(() => {
                expect(screen.getByTestId("modal-bill-amount")).toHaveTextContent("₹0.00");
            });

            fireEvent.click(screen.getByTestId("payment-method-cash"));

            // Confirm button must be disabled because bill amount is <= 0
            const confirmBtn = screen.getByTestId("confirm-payment-btn");
            expect(confirmBtn).toBeDisabled();

            // Calling post must NOT happen
            fireEvent.click(confirmBtn);
            expect(api.post).not.toHaveBeenCalled();
        });
    });
});
