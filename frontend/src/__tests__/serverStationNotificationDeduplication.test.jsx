import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
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

vi.mock("../hooks/useCachedGet", () => ({
    default: (url) => {
        return {
            data: { tables: [] },
            loading: false,
            refresh: vi.fn(),
        };
    },
}));

vi.mock("axios", () => {
    const mockAxiosInstance = {
        get: vi.fn().mockResolvedValue({ data: { unreadCount: 0, notifications: [] } }),
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

vi.mock("../context/AuthContext.jsx", () => ({
    useAuth: () => ({
        user: { id: 101, restaurantId: 1, name: "Server A", role: "SERVER" },
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

describe("Server Station Notification Deduplication & Idempotency", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.keys(socketListeners).forEach((k) => delete socketListeners[k]);
        mockGet.mockResolvedValue({ data: { success: true, count: 1 } });
    });

    const renderServer = () =>
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

    it("1. Server.jsx suppresses duplicate toasts when identical notification is emitted 3 times simultaneously", async () => {
        renderServer();

        await waitFor(() => {
            expect(socketListeners["notification:new"]).toBeDefined();
        });

        const duplicateNotif = {
            id: 9001,
            notificationType: "TABLE_ASSIGNMENT",
            title: "📋 Table Assigned — Table 3",
            message: "Table 3 has been assigned to you. Please check/attend Table 3.",
            data: {
                tableId: 3,
                tableNo: "3",
                action: "ASSIGNED",
                idempotencyKey: "waiter_assigned_3_101_12345",
            },
        };

        // Simulate 3 simultaneous events for the exact same notification
        act(() => {
            socketListeners["notification:new"](duplicateNotif);
            socketListeners["notification:new"](duplicateNotif);
            socketListeners["notification:new"](duplicateNotif);
        });

        // Exactly ONE toast and ONE sound should have been triggered
        expect(mockShowToast).toHaveBeenCalledTimes(1);
        expect(mockPlayNotificationSound).toHaveBeenCalledTimes(1);
        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({
                title: "📋 Table Assigned — Table 3",
                message: "Table 3 has been assigned to you. Please check/attend Table 3.",
                variant: "success",
            })
        );
    });

    it("2. Server.jsx correctly allows distinct legitimate table assignment notifications (e.g. Table 3 and Table 4)", async () => {
        renderServer();

        await waitFor(() => {
            expect(socketListeners["notification:new"]).toBeDefined();
        });

        const notifTable3 = {
            id: 9002,
            notificationType: "TABLE_ASSIGNMENT",
            title: "📋 Table Assigned — Table 3",
            message: "Table 3 has been assigned to you.",
            data: { tableId: 3, tableNo: "3", action: "ASSIGNED" },
        };

        const notifTable4 = {
            id: 9003,
            notificationType: "TABLE_ASSIGNMENT",
            title: "📋 Table Assigned — Table 4",
            message: "Table 4 has been assigned to you.",
            data: { tableId: 4, tableNo: "4", action: "ASSIGNED" },
        };

        // Both distinct notifications should appear
        act(() => {
            socketListeners["notification:new"](notifTable3);
            socketListeners["notification:new"](notifTable4);
        });

        expect(mockShowToast).toHaveBeenCalledTimes(2);
        expect(mockShowToast).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ title: "📋 Table Assigned — Table 3" })
        );
        expect(mockShowToast).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ title: "📋 Table Assigned — Table 4" })
        );
    });

    it("3. ServerNotificationsView increments unread count and appends item only ONCE for duplicate events", async () => {
        const onUnreadCountChange = vi.fn();

        // Render ServerNotificationsView
        const { unmount } = render(
            <MemoryRouter>
                <ServerNotificationsView
                    onUnreadCountChange={onUnreadCountChange}
                    onNavigateToTable={vi.fn()}
                    onBackToFloorPlan={vi.fn()}
                />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(socketListeners["notification:new"]).toBeDefined();
        });

        // Clear initial mount unreadCount callback
        onUnreadCountChange.mockClear();

        const duplicateNotif = {
            id: 9050,
            notificationType: "TABLE_ASSIGNMENT",
            title: "📋 Table Assigned — Table 3",
            message: "Table 3 has been assigned to you.",
            createdAt: new Date().toISOString(),
            isRead: false,
        };

        // Emit duplicate 3 times
        act(() => {
            socketListeners["notification:new"](duplicateNotif);
            socketListeners["notification:new"](duplicateNotif);
            socketListeners["notification:new"](duplicateNotif);
        });

        // Unread count change callback should be called exactly once
        expect(onUnreadCountChange).toHaveBeenCalledTimes(1);
        expect(onUnreadCountChange).toHaveBeenCalledWith(1);

        unmount();
    });
});
