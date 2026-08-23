import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import NewOrder from "../pages/admin/NewOrder.jsx";

// Mock Auth Context
vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({
        user: {
            restaurant: {
                slug: "test-cafe",
                name: "Test Cafe",
            },
        },
    }),
}));

// Mock Staff Socket Context
vi.mock("../context/StaffSocketContext", () => ({
    useStaffSocket: () => ({
        socket: {
            emit: vi.fn((event, data, cb) => {
                if (cb) cb({ ok: true, order: { orderNo: "ORD-101", invoiceNo: "INV-101", items: [], total: 100 } });
            }),
        },
        connected: true,
        error: null,
    }),
}));

// Mock useCachedGet for menu
vi.mock("../hooks/useCachedGet", () => ({
    default: () => ({
        data: {
            menu: [
                { id: 1, name: "Burger", category: "Food", price: 150, image: "" },
                { id: 2, name: "Pizza", category: "Food", price: 200, image: "" },
                { id: 3, name: "Coffee", category: "Beverage", price: 80, image: "" },
            ],
        },
        loading: false,
        error: null,
    }),
}));

describe("Multiple Active Bills / Billing Tabs System", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    const renderBillingDesk = () => {
        return render(
            <MemoryRouter initialEntries={["/owner/pos/new"]}>
                <NewOrder />
            </MemoryRouter>
        );
    };

    it("initializes with Bill #001 as the active bill tab", () => {
        renderBillingDesk();

        expect(screen.getAllByText("Bill #001").length).toBeGreaterThan(0);
        expect(screen.getByText("ACTIVE")).toBeInTheDocument();
    });

    it("creates a new independent bill when + New Bill is clicked", () => {
        renderBillingDesk();

        const newBillBtn = screen.getByText("New Bill");
        fireEvent.click(newBillBtn);

        expect(screen.getAllByText("Bill #001").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Bill #002").length).toBeGreaterThan(0);
    });

    it("preserves individual cart items when switching between multiple bills", () => {
        renderBillingDesk();

        // 1. Add Burger to Bill #001
        const burgerBtn = screen.getByText("Burger");
        fireEvent.click(burgerBtn);

        expect(screen.getAllByText("Rs 150.00").length).toBeGreaterThan(0);

        // 2. Click New Bill -> Bill #002 opens
        fireEvent.click(screen.getByText("New Bill"));

        // Cart for Bill #002 should be empty
        expect(screen.getByText("No items yet")).toBeInTheDocument();

        // 3. Add Coffee to Bill #002
        fireEvent.click(screen.getByText("Coffee"));
        expect(screen.getAllByText("Rs 80.00").length).toBeGreaterThan(0);

        // 4. Switch back to Bill #001
        fireEvent.click(screen.getAllByText("Bill #001")[0]);
        expect(screen.getAllByText("Burger").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Rs 150.00").length).toBeGreaterThan(0);

        // 5. Switch back to Bill #002
        fireEvent.click(screen.getAllByText("Bill #002")[0]);
        expect(screen.getAllByText("Coffee").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Rs 80.00").length).toBeGreaterThan(0);
    });

    it("toggles HELD status for active bills", () => {
        renderBillingDesk();

        const holdBtn = screen.getByTitle("Put this bill on hold");
        fireEvent.click(holdBtn);

        expect(screen.getByText("HELD")).toBeInTheDocument();

        const resumeBtn = screen.getByTitle("Resume this bill");
        fireEvent.click(resumeBtn);

        expect(screen.getByText("ACTIVE")).toBeInTheDocument();
    });
});
