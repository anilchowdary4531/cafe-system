import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import Server from "../pages/Server.jsx";
import ServerNotificationsView from "../components/ServerNotificationsView.jsx";
import { LanguageProvider } from "../context/LanguageContext.jsx";
import { RestaurantThemeProvider } from "../context/ThemeContext.jsx";
import { RestaurantContextProvider } from "../context/RestaurantContext.jsx";
import { CartProvider } from "../context/CartContext.jsx";

// Mock toast and sound player
const mockShowToast = vi.fn();
const mockPlayNotificationSound = vi.fn();
vi.mock("../utils/toast", () => ({
    showToast: (...args) => mockShowToast(...args),
}));
vi.mock("../utils/soundPlayer", () => ({
    playNotificationSound: () => mockPlayNotificationSound(),
}));

// Mock API calls
const mockGet = vi.fn();
vi.mock("../utils/apiClient", () => ({
    api: {
        get: (...args) => mockGet(...args),
        post: vi.fn().mockResolvedValue({ data: { success: true } }),
    },
    cachedGet: vi.fn().mockResolvedValue({ tables: [] }),
    makeGetCacheKey: vi.fn(() => "test-cache-key"),
}));

const mockRefreshTables = vi.fn();
const mockTables = [
    { id: 1, tableNo: "1", seats: 4, restaurantId: 1, assignedWaiterId: null, assignedWaiterName: null },
    { id: 2, tableNo: "2", seats: 2, restaurantId: 1, assignedWaiterId: null, assignedWaiterName: null },
];

vi.mock("../hooks/useCachedGet", () => ({
    default: (url) => {
        return {
            data: { tables: mockTables },
            loading: false,
            refresh: mockRefreshTables,
        };
    },
}));

vi.mock("axios", () => {
    const mockAxiosInstance = {
        get: vi.fn().mockResolvedValue({
            data: {
                unreadCount: 1,
                notifications: [
                    {
                        id: 501,
                        notificationType: "TABLE_ASSIGNMENT",
                        title: "📋 Table Assigned — Table 1",
                        message: "Table 1 has been assigned to you. Please check/attend Table 1.",
                        createdAt: new Date().toISOString(),
                        isRead: false,
                        data: { tableId: 1, tableNo: "1" },
                    },
                ],
            },
        }),
        post: vi.fn().mockResolvedValue({ data: { success: true } }),
        put: vi.fn().mockResolvedValue({ data: { success: true } }),
        delete: vi.fn().mockResolvedValue({ data: { success: true } }),
    };
    mockAxiosInstance.create = vi.fn(() => mockAxiosInstance);
    return {
        default: mockAxiosInstance,
        ...mockAxiosInstance,
    };
});

let mockCurrentUser = { id: 101, restaurantId: 1, name: "Kamalesh", role: "WAITER" };

vi.mock("../context/AuthContext.jsx", () => ({
    useAuth: () => ({
        user: mockCurrentUser,
        token: "fake-jwt-token",
        logout: vi.fn(),
    }),
}));

const socketListeners = {};
const mockSocket = {
    on: vi.fn((event, callback) => {
        socketListeners[event] = callback;
    }),
    off: vi.fn((event, callback) => {
        if (socketListeners[event] === callback) {
            delete socketListeners[event];
        }
    }),
    emit: vi.fn(),
};

vi.mock("../context/StaffSocketContext.jsx", () => ({
    useStaffSocket: () => ({
        socket: mockSocket,
        connected: true,
    }),
}));

describe("TIFFZY — Real-Time Table Assignment Popup Integration Suite", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.keys(socketListeners).forEach((k) => delete socketListeners[k]);
        mockCurrentUser = { id: 101, restaurantId: 1, name: "Kamalesh", role: "WAITER" };
        mockGet.mockResolvedValue({ data: { success: true, count: 1 } });
        axios.get.mockResolvedValue({
            data: {
                unreadCount: 1,
                notifications: [
                    {
                        id: 501,
                        notificationType: "TABLE_ASSIGNMENT",
                        title: "📋 Table Assigned — Table 1",
                        message: "Table 1 has been assigned to you. Please check/attend Table 1.",
                        createdAt: new Date().toISOString(),
                        isRead: false,
                        data: { tableId: 1, tableNo: "1" },
                    },
                ],
            },
        });
    });

    const renderServerStation = (initialEntry = "/server") =>
        render(
            <MemoryRouter initialEntries={[initialEntry]}>
                <LanguageProvider>
                    <RestaurantThemeProvider>
                        <RestaurantContextProvider>
                            <CartProvider>
                                <Routes>
                                    <Route path="/server" element={<Server />} />
                                    <Route path="/server/profile" element={<Server />} />
                                    <Route path="/server/notifications" element={<Server />} />
                                </Routes>
                            </CartProvider>
                        </RestaurantContextProvider>
                    </RestaurantThemeProvider>
                </LanguageProvider>
            </MemoryRouter>
        );

    it("A & B. Owner assigns Table 1 -> Kamalesh on Server Station immediately sees popup with View Table without refresh", async () => {
        renderServerStation("/server");

        await waitFor(() => {
            expect(socketListeners["notification:new"]).toBeDefined();
        });

        const assignmentEvent = {
            id: 8801,
            notificationType: "TABLE_ASSIGNMENT",
            recipientType: "USER",
            recipientId: 101,
            title: "📋 Table Assigned — Table 1",
            message: "Table 1 has been assigned to you. Please check/attend Table 1.",
            tableId: 1,
            tableNo: "1",
            data: {
                tableId: 1,
                tableNo: "1",
                restaurantId: 1,
                action: "ASSIGNED",
            },
        };

        act(() => {
            socketListeners["notification:new"](assignmentEvent);
        });

        // Verifies immediate popup without page refresh
        expect(mockShowToast).toHaveBeenCalledTimes(1);
        expect(mockPlayNotificationSound).toHaveBeenCalledTimes(1);
        expect(mockRefreshTables).toHaveBeenCalledWith({ force: true });

        const toastCall = mockShowToast.mock.calls[0][0];
        expect(toastCall.title).toContain("Table Assigned");
        expect(toastCall.message).toContain("Table 1 has been assigned to you");
        expect(toastCall.actionLabel).toBe("View Table");
        expect(typeof toastCall.onAction).toBe("function");

        // Clicking "View Table" executes action without crashing
        act(() => {
            toastCall.onAction();
        });
    });

    it("C. Kamalesh is on another Server Station page (/server/profile) and receives popup", async () => {
        renderServerStation("/server/profile");

        await waitFor(() => {
            expect(socketListeners["notification:new"]).toBeDefined();
        });

        const assignmentEvent = {
            id: 8802,
            notificationType: "TABLE_ASSIGNMENT",
            recipientType: "USER",
            recipientId: 101,
            title: "📋 Table Assigned — Table 2",
            message: "Table 2 has been assigned to you. Please check/attend Table 2.",
            tableId: 2,
            tableNo: "2",
            data: { tableId: 2, tableNo: "2", action: "ASSIGNED" },
        };

        act(() => {
            socketListeners["notification:new"](assignmentEvent);
        });

        expect(mockShowToast).toHaveBeenCalledTimes(1);
        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({
                title: "📋 Table Assigned — Table 2",
                actionLabel: "View Table",
            })
        );
    });

    it("D. Another server is logged in: other server does NOT receive Kamalesh's assignment popup", async () => {
        renderServerStation("/server");

        await waitFor(() => {
            expect(socketListeners["notification:new"]).toBeDefined();
        });

        // Notification targeted to Server B (user ID 999), while logged-in user is Kamalesh (101)
        const otherServerEvent = {
            id: 8803,
            notificationType: "TABLE_ASSIGNMENT",
            recipientType: "USER",
            recipientId: 999,
            title: "📋 Table Assigned — Table 5",
            message: "Table 5 has been assigned to you.",
            tableId: 5,
            tableNo: "5",
            data: { tableId: 5, tableNo: "5", action: "ASSIGNED" },
        };

        act(() => {
            socketListeners["notification:new"](otherServerEvent);
        });

        // Should NOT trigger any popup or sound for Kamalesh
        expect(mockShowToast).not.toHaveBeenCalled();
        expect(mockPlayNotificationSound).not.toHaveBeenCalled();
    });

    it("E. Duplicate prevention: identical notification arriving multiple times produces exactly ONE popup", async () => {
        renderServerStation("/server");

        await waitFor(() => {
            expect(socketListeners["notification:new"]).toBeDefined();
        });

        const duplicateNotif = {
            id: 8804,
            notificationType: "TABLE_ASSIGNMENT",
            recipientType: "USER",
            recipientId: 101,
            title: "📋 Table Assigned — Table 1",
            message: "Table 1 has been assigned to you.",
            data: { tableId: 1, tableNo: "1", action: "ASSIGNED", idempotencyKey: "idem_8804" },
        };

        act(() => {
            socketListeners["notification:new"](duplicateNotif);
            socketListeners["notification:new"](duplicateNotif);
            socketListeners["notification:new"](duplicateNotif);
        });

        expect(mockShowToast).toHaveBeenCalledTimes(1);
    });

    it("F. Existing Notifications page: notifications appear normally and real-time event updates list", async () => {
        const onUnreadCountChange = vi.fn();
        const onNavigateToTable = vi.fn();

        render(
            <MemoryRouter>
                <ServerNotificationsView
                    onUnreadCountChange={onUnreadCountChange}
                    onNavigateToTable={onNavigateToTable}
                    onBackToFloorPlan={vi.fn()}
                />
            </MemoryRouter>
        );

        // Verify initial fetch of notifications
        await waitFor(() => {
            expect(screen.getByText("Notifications")).toBeDefined();
            expect(screen.getByText(/Table 1 has been assigned to you/)).toBeDefined();
        });

        // Real-time notification arrival updates the view
        const liveNotif = {
            id: 8805,
            notificationType: "TABLE_ASSIGNMENT",
            title: "📋 Table Assigned — Table 2",
            message: "Table 2 has been assigned to you.",
            createdAt: new Date().toISOString(),
            isRead: false,
        };

        act(() => {
            socketListeners["notification:new"](liveNotif);
        });

        await waitFor(() => {
            expect(screen.getByText(/Table 2 has been assigned to you/)).toBeDefined();
        });
    });
});
