import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import OwnerKitchenLive from "../pages/admin/OwnerKitchenLive";

vi.mock("../utils/apiClient", () => ({
    api: {
        get: vi.fn().mockImplementation((url) => {
            if (url.includes("/orders/live")) {
                return Promise.resolve({
                    data: {
                        orders: [
                            {
                                id: 1025,
                                orderNo: "ORD-1025",
                                tableNo: "12",
                                customerName: "Rahul",
                                status: "PREPARING",
                                total: 450,
                                items: [{ itemName: "Cold Coffee", qty: 2, total: 240 }],
                                kots: [{ kotNo: "KOT-1025" }],
                            },
                        ],
                    },
                });
            }
            if (url.includes("/kots")) {
                return Promise.resolve({
                    data: {
                        kots: [
                            {
                                id: 1025,
                                kotNo: "KOT-1025",
                                orderId: 1025,
                                status: "PREPARING",
                                createdBy: "Ramesh",
                                createdAt: new Date().toISOString(),
                                order: { orderNo: "ORD-1025", tableNo: "12" },
                                items: [{ itemName: "Cold Coffee", qty: 2 }],
                            },
                        ],
                    },
                });
            }
            if (url.includes("/stations")) {
                return Promise.resolve({ data: { stations: [{ id: 1, name: "Main Kitchen" }] } });
            }
            if (url.includes("/printers")) {
                return Promise.resolve({
                    data: {
                        printers: [{ id: 1, name: "Kitchen Printer 01", isActive: true, interfaceType: "ESC/POS Network" }],
                    },
                });
            }
            return Promise.resolve({ data: [] });
        }),
        post: vi.fn().mockResolvedValue({ data: { success: true } }),
    },
}));

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({
        user: { restaurantId: 1, role: "OWNER" },
    }),
}));

vi.mock("../context/StaffSocketContext.jsx", () => ({
    useStaffSocket: () => ({
        socket: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
        connected: true,
    }),
}));

describe("Unified Kitchen Operations Page", () => {
    it("renders page header and main navigation tabs", async () => {
        render(
            <MemoryRouter initialEntries={["/owner/kitchen"]}>
                <OwnerKitchenLive />
            </MemoryRouter>
        );

        expect(screen.getByText(/Kitchen Operations/i)).toBeInTheDocument();
        expect(screen.getByText(/Overview/i)).toBeInTheDocument();
        expect(screen.getByText(/Live KOTs/i)).toBeInTheDocument();
        expect(screen.getByText(/KOT Audit Trail/i)).toBeInTheDocument();
        expect(screen.getByText(/Hardware & Print Logs/i)).toBeInTheDocument();
    });

    it("switches tabs when clicked", async () => {
        render(
            <MemoryRouter initialEntries={["/owner/kitchen"]}>
                <OwnerKitchenLive />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByText(/Live KOTs/i));
        expect(screen.getByPlaceholderText(/Search order #, table, customer, or KOT #.../i)).toBeInTheDocument();

        fireEvent.click(screen.getByText(/KOT Audit Trail/i));
        expect(screen.getByPlaceholderText(/Search KOT #, Order #, Table, or Item.../i)).toBeInTheDocument();

        fireEvent.click(screen.getByText(/Hardware & Print Logs/i));
        expect(screen.getByText(/Registered Hardware Devices/i)).toBeInTheDocument();
    });
});
