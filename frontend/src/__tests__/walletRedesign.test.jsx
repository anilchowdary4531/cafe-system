import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import WalletBalanceHero from "../pages/customer/profile/wallet/WalletBalanceHero";
import WalletAnalyticsRow from "../pages/customer/profile/wallet/WalletAnalyticsRow";
import WalletActivityChart from "../pages/customer/profile/wallet/WalletActivityChart";
import WalletTransactionTable from "../pages/customer/profile/wallet/WalletTransactionTable";
import WalletTransactionDetailModal from "../pages/customer/profile/wallet/WalletTransactionDetailModal";

describe("Tiffzy Customer Wallet Redesign Frontend Test Suite", () => {
    describe("WalletBalanceHero", () => {
        it("renders wallet balance and active status correctly", () => {
            render(
                <WalletBalanceHero
                    wallet={{ balance: 3500.5, status: "ACTIVE" }}
                    loadingWallet={false}
                    onAddMoney={vi.fn()}
                    topupLoading={false}
                />
            );

            expect(screen.getByText(/Current Wallet Balance/i)).toBeInTheDocument();
            expect(screen.getByText(/₹3,500.50/i)).toBeInTheDocument();
            expect(screen.getByText(/ACTIVE/i)).toBeInTheDocument();
            expect(screen.getByText(/Use your wallet balance for instant food ordering/i)).toBeInTheDocument();
        });

        it("updates input when clicking quick amount buttons and submits top-up", () => {
            const handleAddMoney = vi.fn();
            render(
                <WalletBalanceHero
                    wallet={{ balance: 1000, status: "ACTIVE" }}
                    loadingWallet={false}
                    onAddMoney={handleAddMoney}
                    topupLoading={false}
                />
            );

            // Click +₹1,000 button
            const btn1000 = screen.getByRole("button", { name: /\+₹1,000/i });
            fireEvent.click(btn1000);

            // Submit button should reflect Add ₹1,000
            const submitBtn = screen.getByRole("button", { name: /Add ₹1,000/i });
            fireEvent.click(submitBtn);

            expect(handleAddMoney).toHaveBeenCalledWith(1000);
        });
    });

    describe("WalletAnalyticsRow", () => {
        it("renders total top-ups, food spend, and total transactions correctly", () => {
            const summary = {
                currentBalance: 3500,
                totalDeposited: 5000,
                totalSpent: 1500,
                totalRefunded: 200,
                totalTransactions: 14,
                monthDeposits: 1200,
                monthSpent: 450,
            };

            render(<WalletAnalyticsRow summary={summary} loading={false} />);

            expect(screen.getByText(/Wallet Summary/i)).toBeInTheDocument();
            expect(screen.getByText(/Total Top-ups/i)).toBeInTheDocument();
            expect(screen.getByText(/\+₹5,000.00/i)).toBeInTheDocument();
            expect(screen.getByText(/Total Food Spend/i)).toBeInTheDocument();
            expect(screen.getByText(/-₹1,500.00/i)).toBeInTheDocument();
            expect(screen.getByText(/Total Transactions/i)).toBeInTheDocument();
            expect(screen.getByText("14")).toBeInTheDocument();
            expect(screen.getByText(/₹1,200.00/i)).toBeInTheDocument();
            expect(screen.getByText(/₹450.00/i)).toBeInTheDocument();
        });
    });

    describe("WalletActivityChart", () => {
        it("renders period selector buttons and responds to click", () => {
            const handlePeriodChange = vi.fn();
            render(
                <WalletActivityChart
                    trend={[]}
                    selectedPeriod="30d"
                    onPeriodChange={handlePeriodChange}
                    loading={false}
                />
            );

            expect(screen.getByText(/Wallet Activity/i)).toBeInTheDocument();
            expect(screen.getByRole("button", { name: /7 Days/i })).toBeInTheDocument();
            expect(screen.getByRole("button", { name: /30 Days/i })).toBeInTheDocument();
            expect(screen.getByRole("button", { name: /3 Months/i })).toBeInTheDocument();
            expect(screen.getByRole("button", { name: /6 Months/i })).toBeInTheDocument();
            expect(screen.getByRole("button", { name: /1 Year/i })).toBeInTheDocument();
            expect(screen.getByRole("button", { name: /All/i })).toBeInTheDocument();

            // Click 7 Days
            fireEvent.click(screen.getByRole("button", { name: /7 Days/i }));
            expect(handlePeriodChange).toHaveBeenCalledWith("7d");

            // Click 3 Months
            fireEvent.click(screen.getByRole("button", { name: /3 Months/i }));
            expect(handlePeriodChange).toHaveBeenCalledWith("3m");

            // Click 1 Year
            fireEvent.click(screen.getByRole("button", { name: /1 Year/i }));
            expect(handlePeriodChange).toHaveBeenCalledWith("1y");
        });

        it("shows empty state when no activity points exist", () => {
            render(
                <WalletActivityChart
                    trend={[]}
                    selectedPeriod="30d"
                    onPeriodChange={vi.fn()}
                    loading={false}
                />
            );

            expect(screen.getByText(/No wallet activity in this period/i)).toBeInTheDocument();
            expect(screen.getByText(/Not enough activity to display a trend/i)).toBeInTheDocument();
        });

        it("shows error state with retry button when analytics fails", () => {
            const handleRetry = vi.fn();
            render(
                <WalletActivityChart
                    trend={[]}
                    selectedPeriod="30d"
                    onPeriodChange={vi.fn()}
                    loading={false}
                    error="Network timeout"
                    onRetry={handleRetry}
                />
            );

            expect(screen.getByText(/Unable to load wallet activity/i)).toBeInTheDocument();
            expect(screen.getByText(/Network timeout/i)).toBeInTheDocument();

            const retryBtn = screen.getByRole("button", { name: /Retry/i });
            fireEvent.click(retryBtn);
            expect(handleRetry).toHaveBeenCalled();
        });
    });

    describe("WalletTransactionTable", () => {
        const mockTxns = [
            {
                id: "txn_1",
                type: "WALLET_TOPUP",
                direction: "CREDIT",
                amount: 500,
                balanceBefore: 1000,
                balanceAfter: 1500,
                description: "Cashfree Top-up",
                orderId: null,
                referenceId: "CF_123",
                status: "SUCCESS",
                createdAt: "2026-10-10T12:00:00Z",
            },
            {
                id: "txn_2",
                type: "ORDER_PAYMENT",
                direction: "DEBIT",
                amount: 150,
                balanceBefore: 1500,
                balanceAfter: 1350,
                description: "Order #501 payment",
                orderId: "501",
                referenceId: "ORD_501",
                status: "SUCCESS",
                createdAt: "2026-10-11T14:30:00Z",
            },
        ];

        it("renders transaction table with filter tabs and formatted values", () => {
            const handleTypeChange = vi.fn();
            const handleSelectTxn = vi.fn();

            render(
                <WalletTransactionTable
                    transactions={mockTxns}
                    total={2}
                    page={1}
                    totalPages={1}
                    limit={10}
                    loading={false}
                    activeType=""
                    onTypeChange={handleTypeChange}
                    onPageChange={vi.fn()}
                    onSelectTransaction={handleSelectTxn}
                />
            );

            expect(screen.getByText(/Latest Wallet Transactions/i)).toBeInTheDocument();
            expect(screen.getByRole("button", { name: /Top-ups/i })).toBeInTheDocument();
            expect(screen.getByRole("button", { name: /Food Orders/i })).toBeInTheDocument();
            expect(screen.getByRole("button", { name: /Refunds/i })).toBeInTheDocument();

            // Check amounts
            expect(screen.getAllByText(/\+₹500.00/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/-₹150.00/i).length).toBeGreaterThan(0);

            // Filter button click
            fireEvent.click(screen.getByRole("button", { name: /Top-ups/i }));
            expect(handleTypeChange).toHaveBeenCalledWith("WALLET_TOPUP");
        });

        it("filters transactions client-side based on search query", () => {
            render(
                <WalletTransactionTable
                    transactions={mockTxns}
                    total={2}
                    page={1}
                    totalPages={1}
                    limit={10}
                    loading={false}
                    activeType=""
                    onTypeChange={vi.fn()}
                    onPageChange={vi.fn()}
                    onSelectTransaction={vi.fn()}
                />
            );

            const searchInput = screen.getByPlaceholderText(/Search transactions.../i);
            fireEvent.change(searchInput, { target: { value: "501" } });

            expect(screen.queryByText(/Cashfree Top-up/i)).not.toBeInTheDocument();
            expect(screen.getAllByText(/Order #501 payment/i).length).toBeGreaterThan(0);
        });
    });

    describe("WalletTransactionDetailModal", () => {
        it("renders complete transaction details and closes on close button or ESC", () => {
            const handleClose = vi.fn();
            const txn = {
                id: "txn_detail_1",
                type: "WALLET_TOPUP",
                direction: "CREDIT",
                amount: 1000,
                balanceBefore: 2000,
                balanceAfter: 3000,
                description: "Cashfree Instant Deposit",
                orderId: null,
                referenceId: "REF_9988",
                referenceType: "CASHFREE_PPI",
                status: "SUCCESS",
                createdAt: "2026-10-11T10:00:00Z",
            };

            const { rerender } = render(
                <WalletTransactionDetailModal transaction={txn} onClose={handleClose} />
            );

            expect(screen.getByText(/Transaction Details/i)).toBeInTheDocument();
            expect(screen.getByText(/\+₹1,000.00/i)).toBeInTheDocument();
            expect(screen.getByText(/Cashfree Instant Deposit/i)).toBeInTheDocument();
            expect(screen.getByText(/₹2,000.00/i)).toBeInTheDocument();
            expect(screen.getByText(/₹3,000.00/i)).toBeInTheDocument();
            expect(screen.getByText(/REF_9988/i)).toBeInTheDocument();
            expect(screen.getByText(/CASHFREE_PPI/i)).toBeInTheDocument();

            // Press ESC
            fireEvent.keyDown(window, { key: "Escape" });
            expect(handleClose).toHaveBeenCalled();
        });
    });
});
