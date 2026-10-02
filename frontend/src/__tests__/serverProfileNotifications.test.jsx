import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import ServerProfileView from "../components/ServerProfileView";
import ServerNotificationsView from "../components/ServerNotificationsView";
import { BrowserRouter } from "react-router-dom";
import axios from "axios";

const mockUser = {
    id: 101,
    name: "Rahul Waiter",
    email: "rahul@tiffzy.com",
    phone: "9876543210",
    role: "WAITER",
    designation: "Senior Server",
    restaurantId: 1,
    restaurant: { name: "Tiffzy Fine Dining" },
    isActive: true,
};

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({
        user: mockUser,
        token: "fake-jwt-token",
        logout: vi.fn(),
    }),
}));

vi.mock("axios", () => ({
    default: {
        get: vi.fn(),
        put: vi.fn(),
        post: vi.fn(),
        patch: vi.fn(),
    },
}));

vi.mock("../context/StaffSocketContext", () => ({
    useStaffSocket: () => ({
        socket: {
            on: vi.fn(),
            off: vi.fn(),
        },
    }),
}));

const renderWithProviders = (ui) => {
    return render(
        <BrowserRouter>
            {ui}
        </BrowserRouter>
    );
};

describe("ServerProfileView Unit Tests", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        axios.get.mockImplementation((url) => {
            if (url.includes("/staff/profile/me")) {
                return Promise.resolve({ data: { success: true, profile: mockUser } });
            }
            return Promise.reject(new Error("Not found"));
        });
    });

    it("renders server profile information correctly", async () => {
        renderWithProviders(<ServerProfileView onBackToFloorPlan={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByText("Rahul Waiter")).toBeInTheDocument();
            expect(screen.getByText("rahul@tiffzy.com")).toBeInTheDocument();
            expect(screen.getByText("9876543210")).toBeInTheDocument();
            expect(screen.getByText("Tiffzy Fine Dining")).toBeInTheDocument();
            expect(screen.getByText("RW")).toBeInTheDocument();
        });
    });

    it("allows editing permitted profile fields (name and phone)", async () => {
        axios.put.mockResolvedValueOnce({
            data: {
                success: true,
                profile: { ...mockUser, name: "Rahul Sharma", phone: "9999999999" },
            },
        });

        renderWithProviders(<ServerProfileView onBackToFloorPlan={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByText("Rahul Waiter")).toBeInTheDocument();
        });

        const editBtn = screen.getByRole("button", { name: /edit profile/i });
        fireEvent.click(editBtn);

        const nameInput = screen.getByPlaceholderText(/enter your full name/i);
        fireEvent.change(nameInput, { target: { value: "Rahul Sharma" } });

        const saveBtn = screen.getByRole("button", { name: /save changes/i });
        fireEvent.click(saveBtn);

        await waitFor(() => {
            expect(axios.put).toHaveBeenCalledWith(
                expect.stringContaining("/staff/profile/me"),
                expect.objectContaining({ name: "Rahul Sharma" }),
                expect.any(Object)
            );
        });
    });

    it("handles password change with validation", async () => {
        axios.post.mockResolvedValueOnce({
            data: { success: true, message: "Password updated successfully" },
        });

        renderWithProviders(<ServerProfileView onBackToFloorPlan={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByText("Rahul Waiter")).toBeInTheDocument();
        });

        const currentPass = screen.getByPlaceholderText(/enter current password/i);
        const newPass = screen.getByPlaceholderText(/at least 6 characters/i);
        const confirmPass = screen.getByPlaceholderText(/re-enter new password/i);

        fireEvent.change(currentPass, { target: { value: "oldpassword123" } });
        fireEvent.change(newPass, { target: { value: "newpassword123" } });
        fireEvent.change(confirmPass, { target: { value: "newpassword123" } });

        const submitPassBtn = screen.getByRole("button", { name: /change password/i });
        fireEvent.click(submitPassBtn);

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("/auth/change-password"),
                expect.objectContaining({
                    currentPassword: "oldpassword123",
                    newPassword: "newpassword123",
                }),
                expect.any(Object)
            );
        });
    });
});

describe("ServerNotificationsView Unit Tests", () => {
    const mockNotifications = [
        {
            id: 1,
            title: "Food Ready at Pass",
            message: "Table 4 - Pizza Pepperoni is ready",
            type: "KITCHEN",
            isRead: false,
            createdAt: new Date().toISOString(),
            data: { tableNo: "4" },
        },
        {
            id: 2,
            title: "New Order Placed",
            message: "Table 2 placed a new order",
            type: "ORDER",
            isRead: true,
            createdAt: new Date().toISOString(),
            data: { tableNo: "2" },
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        axios.get.mockImplementation((url) => {
            if (url.includes("/notifications")) {
                return Promise.resolve({
                    data: {
                        success: true,
                        notifications: mockNotifications,
                        total: 2,
                        unreadCount: 1,
                        hasMore: false,
                    },
                });
            }
            return Promise.reject(new Error("Not found"));
        });
    });

    it("fetches and renders notifications list with header and badges", async () => {
        renderWithProviders(<ServerNotificationsView onBackToFloorPlan={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByText("Food Ready at Pass")).toBeInTheDocument();
            expect(screen.getByText("New Order Placed")).toBeInTheDocument();
            expect(screen.getByText("Table 4")).toBeInTheDocument();
            expect(screen.getByText("Table 2")).toBeInTheDocument();
        });
    });

    it("filters notifications by category tabs and search query", async () => {
        renderWithProviders(<ServerNotificationsView onBackToFloorPlan={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByText("Food Ready at Pass")).toBeInTheDocument();
        });

        // Click UNREAD tab
        const unreadTab = screen.getByRole("button", { name: "UNREAD" });
        fireEvent.click(unreadTab);

        expect(screen.getByText("Food Ready at Pass")).toBeInTheDocument();
        expect(screen.queryByText("New Order Placed")).not.toBeInTheDocument();

        // Click ALL tab
        const allTab = screen.getByRole("button", { name: "ALL" });
        fireEvent.click(allTab);
        expect(screen.getByText("New Order Placed")).toBeInTheDocument();

        // Search Query
        const searchInput = screen.getByPlaceholderText(/search notifications/i);
        fireEvent.change(searchInput, { target: { value: "Pepperoni" } });

        expect(screen.getByText("Food Ready at Pass")).toBeInTheDocument();
        expect(screen.queryByText("New Order Placed")).not.toBeInTheDocument();
    });

    it("triggers table navigation when View Table button is clicked", async () => {
        const onNavigateMock = vi.fn();
        renderWithProviders(<ServerNotificationsView onNavigateToTable={onNavigateMock} />);

        await waitFor(() => {
            expect(screen.getByText("Food Ready at Pass")).toBeInTheDocument();
        });

        const viewTableBtn = screen.getByTitle("View Table 4");
        fireEvent.click(viewTableBtn);

        expect(onNavigateMock).toHaveBeenCalledWith("4");
    });

    it("toggles Sound Settings panel when clicked", async () => {
        renderWithProviders(<ServerNotificationsView onBackToFloorPlan={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByText("Notifications")).toBeInTheDocument();
        });

        const soundSettingsBtn = screen.getByTitle("Adjust Notification Sound");
        fireEvent.click(soundSettingsBtn);

        await waitFor(() => {
            expect(screen.getByText("Notification Sound")).toBeInTheDocument();
        });
    });

    it("marks single notification as read", async () => {
        axios.patch.mockResolvedValueOnce({ data: { success: true } });

        renderWithProviders(<ServerNotificationsView onBackToFloorPlan={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByText("Food Ready at Pass")).toBeInTheDocument();
        });

        const markReadBtn = screen.getByTitle("Mark Read");
        fireEvent.click(markReadBtn);

        await waitFor(() => {
            expect(axios.patch).toHaveBeenCalledWith(
                expect.stringContaining("/notifications/1/read"),
                {},
                expect.any(Object)
            );
        });
    });

    it("marks all notifications as read", async () => {
        axios.patch.mockResolvedValueOnce({ data: { success: true } });

        renderWithProviders(<ServerNotificationsView onBackToFloorPlan={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByText("Food Ready at Pass")).toBeInTheDocument();
        });

        const markAllBtn = screen.getByRole("button", { name: /mark all as read/i });
        fireEvent.click(markAllBtn);

        await waitFor(() => {
            expect(axios.patch).toHaveBeenCalledWith(
                expect.stringContaining("/notifications/read-all"),
                {},
                expect.any(Object)
            );
        });
    });
});
