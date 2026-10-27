import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Kitchen from "../pages/Kitchen";
import { useAuth } from "../context/AuthContext";
import { useStaffSocket } from "../context/StaffSocketContext";
import { api } from "../utils/apiClient";

vi.mock("../context/AuthContext", () => ({
    useAuth: vi.fn(),
}));

vi.mock("../context/StaffSocketContext", () => ({
    useStaffSocket: vi.fn(),
}));

vi.mock("axios", () => ({
    default: {
        get: vi.fn().mockResolvedValue({
            data: {
                notifications: [],
                total: 0,
                unreadCount: 0,
            },
        }),
    },
}));

vi.mock("../utils/apiClient", () => ({
    api: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
    },
}));

vi.mock("../utils/soundPlayer", () => ({
    playNotificationSound: vi.fn(),
}));

vi.mock("../utils/toast", () => ({
    showToast: vi.fn(),
}));

describe("Kitchen Profile & Notifications Integration", () => {
    let mockSocket;
    const mockUser = {
        id: 42,
        name: "Chef Gordon",
        username: "gordon",
        role: "CHEF",
        designation: "Head Chef",
        restaurantId: 1,
        restaurant: { id: 1, name: "Tiffzy Central" },
    };

    beforeEach(() => {
        vi.clearAllMocks();

        mockSocket = {
            on: vi.fn(),
            off: vi.fn(),
            emit: vi.fn(),
            connected: true,
        };

        useAuth.mockReturnValue({
            user: mockUser,
            token: "valid-chef-token",
            logout: vi.fn(),
        });

        useStaffSocket.mockReturnValue({
            socket: mockSocket,
            connected: true,
            error: null,
        });

        api.get.mockImplementation((url) => {
            if (url.includes("/stations")) {
                return Promise.resolve({ data: { stations: [{ id: 10, name: "Grill Station" }] } });
            }
            if (url.includes("/kots")) {
                return Promise.resolve({
                    data: {
                        kots: [
                            {
                                id: 101,
                                kotNo: "KOT-101",
                                status: "PENDING",
                                priority: "NORMAL",
                                stationId: 10,
                                stationName: "Grill Station",
                                tableNo: "T1",
                                items: [{ id: 1, itemName: "Tandoori Paneer", quantity: 2, status: "PENDING" }],
                            },
                        ],
                    },
                });
            }
            if (url.includes("/unread-count")) {
                return Promise.resolve({ data: { success: true, count: 3 } });
            }
            return Promise.resolve({ data: {} });
        });
    });

    it("renders KDS header with Notifications and Profile buttons and displays unread badge", async () => {
        render(
            <MemoryRouter initialEntries={["/kitchen"]}>
                <Kitchen />
            </MemoryRouter>
        );

        // Header Title
        expect(screen.getByText(/Kitchen Operations KDS/i)).toBeInTheDocument();

        // Check Notifications button
        const notifBtn = screen.getByTitle("Kitchen Notifications");
        expect(notifBtn).toBeInTheDocument();

        // Check Profile button with Chef initials
        const profileBtn = screen.getByTitle("My Profile");
        expect(profileBtn).toBeInTheDocument();
        expect(screen.getByText("Chef")).toBeInTheDocument();
        expect(screen.getByText("C")).toBeInTheDocument();

        // Wait for unread count badge to populate
        await waitFor(() => {
            expect(screen.getByText("3")).toBeInTheDocument();
        });
    });

    it("switches to ServerNotificationsView on notifications click and back to KDS on back click", async () => {
        render(
            <MemoryRouter initialEntries={["/kitchen"]}>
                <Kitchen />
            </MemoryRouter>
        );

        // Click Notifications button
        const notifBtn = screen.getByTitle("Kitchen Notifications");
        fireEvent.click(notifBtn);

        // Should render notification view with "Back to Kitchen" button
        await waitFor(() => {
            expect(screen.getByTitle("Back to Kitchen")).toBeInTheDocument();
        });

        // Click back button to return to KDS
        const backBtn = screen.getByTitle("Back to Kitchen");
        fireEvent.click(backBtn);

        // Should be back to KDS board
        await waitFor(() => {
            expect(screen.getByText(/ALL STATIONS/i)).toBeInTheDocument();
        });
    });

    it("switches to ServerProfileView on profile click and back to KDS on back click", async () => {
        render(
            <MemoryRouter initialEntries={["/kitchen"]}>
                <Kitchen />
            </MemoryRouter>
        );

        // Click Profile button
        const profileBtn = screen.getByTitle("My Profile");
        fireEvent.click(profileBtn);

        // Should render Kitchen Profile view with "Kitchen" back button
        await waitFor(() => {
            expect(screen.getByText(/Kitchen Profile/i)).toBeInTheDocument();
            expect(screen.getByRole("button", { name: /Kitchen/i })).toBeInTheDocument();
        });

        // Click back button to return to KDS
        const backBtn = screen.getByRole("button", { name: /Kitchen/i });
        fireEvent.click(backBtn);

        // Should be back to KDS board
        await waitFor(() => {
            expect(screen.getByText(/ALL STATIONS/i)).toBeInTheDocument();
        });
    });

    it("registers socket listener for notification:new and cleans up on unmount", () => {
        const { unmount } = render(
            <MemoryRouter initialEntries={["/kitchen"]}>
                <Kitchen />
            </MemoryRouter>
        );

        expect(mockSocket.on).toHaveBeenCalledWith("notification:new", expect.any(Function));

        unmount();

        expect(mockSocket.off).toHaveBeenCalledWith("notification:new", expect.any(Function));
    });
});
