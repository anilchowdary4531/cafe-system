import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import Server, { resolveTableActiveOrderStatus, isTablePaymentPending, ORDER_STATUS_CONFIG } from "../pages/Server.jsx";
import OwnerNotifications from "../pages/admin/OwnerNotifications.jsx";
import axios from "axios";

// Mock socket
const mockSocketHandlers = {};
const mockSocket = {
    on: vi.fn((event, handler) => {
        mockSocketHandlers[event] = handler;
    }),
    off: vi.fn((event) => {
        delete mockSocketHandlers[event];
    }),
    emit: vi.fn(),
    connected: true,
};

vi.mock("../context/StaffSocketContext", () => ({
    useStaffSocket: () => ({
        socket: mockSocket,
        connected: true,
    }),
}));

const mockUser = {
    id: 17,
    name: "saimohan",
    role: "WAITER",
    designation: "SERVER",
    restaurantId: 1,
};

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({
        user: mockUser,
        token: "mock-valid-token",
        logout: vi.fn(),
    }),
}));

vi.mock("../utils/staffSessionStorage", () => ({
    getActiveStaffToken: () => "mock-valid-token",
    getActiveStaffSession: () => ({ token: "mock-valid-token", user: mockUser }),
}));

vi.mock("../context/LanguageContext", () => ({
    useLanguage: () => ({ t: (k) => k }),
    LanguageProvider: ({ children }) => <div>{children}</div>,
}));

vi.mock("../context/ThemeContext", () => ({
    useRestaurantTheme: () => ({ theme: "light" }),
    RestaurantThemeProvider: ({ children }) => <div>{children}</div>,
}));

vi.mock("../context/RestaurantContext", () => ({
    useRestaurant: () => ({ restaurant: { id: 1, name: "Cafe King" } }),
    RestaurantContextProvider: ({ children }) => <div>{children}</div>,
}));

vi.mock("../context/SocketContext", () => ({
    useSocket: () => ({ socket: mockSocket, isConnected: true }),
}));

describe("ORDER DELIVERY LIFECYCLE DECOUPLING & AUTHORITATIVE DISPLAY SUITE", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("1. isTablePaymentPending returns false for READY items (food is not yet delivered)", () => {
        const tableReady = {
            id: 8,
            tableNo: "1",
            status: "OCCUPIED",
            isOccupied: true,
            activeOrderStatus: "READY",
            activeOrders: [{ id: 419, status: "READY", paymentStatus: "PENDING" }],
        };

        expect(isTablePaymentPending(tableReady)).toBe(false);
    });

    it("2. isTablePaymentPending returns true for DELIVERED and unpaid items (revealing Settle Payment button)", () => {
        const tableDeliveredUnpaid = {
            id: 8,
            tableNo: "1",
            status: "OCCUPIED",
            isOccupied: true,
            activeOrderStatus: "DELIVERED",
            activeOrders: [{ id: 419, status: "DELIVERED", paymentStatus: "PENDING" }],
        };

        expect(isTablePaymentPending(tableDeliveredUnpaid)).toBe(true);
    });

    it("3. resolveTableActiveOrderStatus directly resolves authoritative activeOrderStatus: DELIVERED", () => {
        const tableDelivered = {
            id: 8,
            tableNo: "1",
            activeOrderStatus: "DELIVERED",
            activeOrders: [{ id: 419, status: "DELIVERED", paymentStatus: "PENDING" }],
        };

        expect(resolveTableActiveOrderStatus(tableDelivered)).toBe("DELIVERED");
    });

    it("4. ORDER_STATUS_CONFIG defines distinct icons and styling for READY, DELIVERED, and PAYMENT_PENDING", () => {
        expect(ORDER_STATUS_CONFIG.READY.label).toBe("READY");
        expect(ORDER_STATUS_CONFIG.DELIVERED.label).toBe("DELIVERED");
        expect(ORDER_STATUS_CONFIG.PAYMENT_PENDING.label).toBe("PAYMENT_PENDING");

        expect(ORDER_STATUS_CONFIG.DELIVERED.icon).toBe("📦");
        expect(ORDER_STATUS_CONFIG.PAYMENT_PENDING.icon).toBe("💳");
    });
});
