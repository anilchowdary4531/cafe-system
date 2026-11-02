import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";
import { BrowserRouter } from "react-router-dom";
import OwnerNotifications from "../pages/admin/OwnerNotifications";
import ServerNotificationsView from "../components/ServerNotificationsView";
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
    id: 99,
    name: "Owner Alice",
    role: "OWNER",
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

vi.mock("axios", () => {
    const mockAxiosInstance = {
        get: vi.fn(),
        post: vi.fn().mockResolvedValue({ data: { success: true } }),
        put: vi.fn().mockResolvedValue({ data: { success: true } }),
        patch: vi.fn().mockResolvedValue({ data: { success: true } }),
    };
    mockAxiosInstance.create = vi.fn(() => mockAxiosInstance);
    return {
        default: mockAxiosInstance,
        ...mockAxiosInstance,
    };
});

describe("Owner & Server Delivery Notification Display Integration Suite", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        sessionStorage.clear();
    });

    it("1. OwnerNotifications renders ORDER_DELIVERED from GET /api/notifications", async () => {
        axios.get.mockResolvedValueOnce({
            data: {
                notifications: [
                    {
                        id: 501,
                        notificationType: "ORDER_DELIVERED",
                        title: "Food Delivered — Table 101",
                        message: "Paneer Tikka delivered to Table 101.",
                        isRead: false,
                        createdAt: new Date().toISOString(),
                        data: { tableNo: "101", tableId: 12 },
                    },
                ],
                total: 1,
                unreadCount: 1,
            },
        });

        render(
            <BrowserRouter>
                <OwnerNotifications />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Food Delivered — Table 101")).toBeInTheDocument();
            expect(screen.getByText("Paneer Tikka delivered to Table 101.")).toBeInTheDocument();
            expect(screen.getByText("Table 101")).toBeInTheDocument();
        });
    });

    it("2. OwnerNotifications receives realtime notification:new ORDER_DELIVERED and updates list", async () => {
        axios.get.mockResolvedValueOnce({
            data: {
                notifications: [],
                total: 0,
                unreadCount: 0,
            },
        });

        render(
            <BrowserRouter>
                <OwnerNotifications />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Notifications Log")).toBeInTheDocument();
        });

        const liveNotif = {
            id: 602,
            notificationType: "ORDER_DELIVERED",
            title: "Food Delivered — Table 5",
            message: "Butter Naan delivered to Table 5.",
            isRead: false,
            createdAt: new Date().toISOString(),
            data: { tableNo: "5", tableId: 15 },
        };

        act(() => {
            if (mockSocketHandlers["notification:new"]) {
                mockSocketHandlers["notification:new"](liveNotif);
            }
        });

        expect(screen.getByText("Food Delivered — Table 5")).toBeInTheDocument();
        expect(screen.getByText("Butter Naan delivered to Table 5.")).toBeInTheDocument();
        expect(screen.getByText("Table 5")).toBeInTheDocument();
    });

    it("3. OwnerNotifications filter tabs (ORDERS, SUCCESS) include ORDER_DELIVERED", async () => {
        axios.get.mockResolvedValueOnce({
            data: {
                notifications: [
                    {
                        id: 701,
                        notificationType: "ORDER_DELIVERED",
                        title: "Food Delivered — Table 7",
                        message: "Veg Biryani delivered to Table 7.",
                        isRead: false,
                        createdAt: new Date().toISOString(),
                        data: { tableNo: "7" },
                    },
                ],
                total: 1,
                unreadCount: 1,
            },
        });

        render(
            <BrowserRouter>
                <OwnerNotifications />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Food Delivered — Table 7")).toBeInTheDocument();
        });

        // Click ORDERS tab
        const ordersTab = screen.getByRole("button", { name: "ORDERS" });
        fireEvent.click(ordersTab);
        expect(screen.getByText("Food Delivered — Table 7")).toBeInTheDocument();

        // Click SUCCESS tab
        const successTab = screen.getByRole("button", { name: "SUCCESS" });
        fireEvent.click(successTab);
        expect(screen.getByText("Food Delivered — Table 7")).toBeInTheDocument();
    });

    it("4. ServerNotificationsView renders ORDER_DELIVERED and table badge", async () => {
        axios.get.mockResolvedValueOnce({
            data: {
                notifications: [
                    {
                        id: 801,
                        notificationType: "ORDER_DELIVERED",
                        title: "Food Delivered — Table 12",
                        message: "Chicken Tikka delivered to Table 12.",
                        isRead: false,
                        createdAt: new Date().toISOString(),
                        data: { tableNo: "12", tableId: 44 },
                    },
                ],
                total: 1,
                unreadCount: 1,
            },
        });

        const onNavigate = vi.fn();
        render(
            <ServerNotificationsView
                onNavigateToTable={onNavigate}
                onBackToFloorPlan={vi.fn()}
            />
        );

        await waitFor(() => {
            expect(screen.getByText("Food Delivered — Table 12")).toBeInTheDocument();
            expect(screen.getByText("Chicken Tikka delivered to Table 12.")).toBeInTheDocument();
            expect(screen.getByText("Table 12")).toBeInTheDocument();
        });

        const viewTableBtn = screen.getByTitle("View Table 12");
        fireEvent.click(viewTableBtn);
        expect(onNavigate).toHaveBeenCalledWith("12", 44);
    });

    it("5. ServerNotificationsView receives realtime notification:new ORDER_DELIVERED and shows under ALL and SUCCESS", async () => {
        axios.get.mockResolvedValueOnce({
            data: {
                notifications: [],
                total: 0,
                unreadCount: 0,
            },
        });

        const onCountChange = vi.fn();
        render(
            <ServerNotificationsView
                onUnreadCountChange={onCountChange}
                onBackToFloorPlan={vi.fn()}
            />
        );

        await waitFor(() => {
            expect(screen.getByText("Notifications")).toBeInTheDocument();
        });

        const liveNotif = {
            id: 905,
            notificationType: "ORDER_DELIVERED",
            title: "Food Delivered — Table 3",
            message: "Masala Dosa delivered to Table 3.",
            isRead: false,
            createdAt: new Date().toISOString(),
            data: { tableNo: "3", tableId: 30 },
        };

        act(() => {
            if (mockSocketHandlers["notification:new"]) {
                mockSocketHandlers["notification:new"](liveNotif);
            }
        });

        expect(screen.getByText("Food Delivered — Table 3")).toBeInTheDocument();
        expect(screen.getByText("Masala Dosa delivered to Table 3.")).toBeInTheDocument();
        expect(onCountChange).toHaveBeenCalledWith(1);

        // Click SUCCESS tab
        const successTab = screen.getByRole("button", { name: "SUCCESS" });
        fireEvent.click(successTab);
        expect(screen.getByText("Food Delivered — Table 3")).toBeInTheDocument();
    });
});
