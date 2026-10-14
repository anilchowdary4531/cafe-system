import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import axios from "axios";
import StaffDirectoryDrawer from "../components/StaffDirectoryDrawer";

vi.mock("axios");
vi.mock("../utils/toast", () => ({
    showToast: vi.fn(),
}));

const mockStaffUsers = [
    {
        id: 101,
        name: "Alice Waiter",
        email: "alice@restaurant.com",
        phone: "9876543210",
        role: "WAITER",
        designation: "Server",
        isActive: true,
        restaurantId: 1,
        createdAt: "2026-10-10T10:00:00.000Z",
        access: { dashboard: true, tables: true, orders: true },
    },
    {
        id: 102,
        name: "Bob Chef",
        email: "bob@restaurant.com",
        phone: "9876543211",
        role: "CHEF",
        designation: "Senior Chef",
        isActive: true,
        restaurantId: 1,
        createdAt: "2026-10-11T10:00:00.000Z",
        access: { dashboard: true, kitchen: true, orders: true },
    },
    {
        id: 103,
        name: "Charlie Disabled",
        email: "charlie@restaurant.com",
        phone: "9876543212",
        role: "CASHIER",
        designation: "Cashier",
        isActive: false,
        restaurantId: 1,
        createdAt: "2026-10-12T10:00:00.000Z",
        access: { dashboard: true, billing: true },
    },
];

describe("Staff Directory Drawer — Edit Button and Workflow", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        axios.get.mockResolvedValue({
            data: {
                users: mockStaffUsers,
            },
        });
        axios.put.mockResolvedValue({
            data: {
                success: true,
            },
        });

        // Mock clipboard
        Object.assign(navigator, {
            clipboard: {
                writeText: vi.fn().mockImplementation(() => Promise.resolve()),
            },
        });

        // Mock window.open
        vi.spyOn(window, "open").mockImplementation(() => {});
    });

    it("1. Edit button appears for every staff member card", async () => {
        render(
            <StaffDirectoryDrawer
                isOpen={true}
                onClose={vi.fn()}
                restaurantId={1}
            />
        );

        await waitFor(() => {
            expect(screen.getByText("Alice Waiter")).toBeInTheDocument();
            expect(screen.getByText("Bob Chef")).toBeInTheDocument();
            expect(screen.getByText("Charlie Disabled")).toBeInTheDocument();
        });

        const editButtons = screen.getAllByRole("button", { name: /edit/i });
        expect(editButtons.length).toBe(3);

        // Check specific data-testid on each card's edit button
        expect(screen.getByTestId("edit-staff-101")).toBeInTheDocument();
        expect(screen.getByTestId("edit-staff-102")).toBeInTheDocument();
        expect(screen.getByTestId("edit-staff-103")).toBeInTheDocument();
    });

    it("2. Correct staff ID is associated with Edit button", async () => {
        render(
            <StaffDirectoryDrawer
                isOpen={true}
                onClose={vi.fn()}
                restaurantId={1}
            />
        );

        await waitFor(() => {
            expect(screen.getByText("Alice Waiter")).toBeInTheDocument();
        });

        const editAlice = screen.getByTestId("edit-staff-101");
        expect(editAlice).toBeInTheDocument();

        fireEvent.click(editAlice);

        expect(screen.getByText(/ID: #101/i)).toBeInTheDocument();
    });

    it("3. Clicking Edit opens the existing edit form modal", async () => {
        render(
            <StaffDirectoryDrawer
                isOpen={true}
                onClose={vi.fn()}
                restaurantId={1}
            />
        );

        await waitFor(() => {
            expect(screen.getByText("Alice Waiter")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId("edit-staff-101"));

        expect(screen.getByTestId("staff-edit-modal")).toBeInTheDocument();
        expect(screen.getByText(/Editing Staff Profile: Alice Waiter/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Save Staff Updates/i })).toBeInTheDocument();
    });

    it("4. Existing staff information is pre-populated in edit form", async () => {
        render(
            <StaffDirectoryDrawer
                isOpen={true}
                onClose={vi.fn()}
                restaurantId={1}
            />
        );

        await waitFor(() => {
            expect(screen.getByText("Alice Waiter")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId("edit-staff-101"));

        const nameInput = screen.getByPlaceholderText(/full name/i);
        const emailInput = screen.getByPlaceholderText(/email address/i);
        const phoneInput = screen.getByPlaceholderText(/phone number/i);
        const roleSelect = screen.getByRole("combobox", { name: /role/i });

        expect(nameInput.value).toBe("Alice Waiter");
        expect(emailInput.value).toBe("alice@restaurant.com");
        expect(phoneInput.value).toBe("9876543210");
        expect(roleSelect.value).toBe("WAITER");
    });

    it("5. Saving edits updates the correct staff member via backend API", async () => {
        render(
            <StaffDirectoryDrawer
                isOpen={true}
                onClose={vi.fn()}
                restaurantId={1}
            />
        );

        await waitFor(() => {
            expect(screen.getByText("Alice Waiter")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId("edit-staff-101"));

        const nameInput = screen.getByPlaceholderText(/full name/i);
        fireEvent.change(nameInput, { target: { value: "Alice Updated" } });

        const phoneInput = screen.getByPlaceholderText(/phone number/i);
        fireEvent.change(phoneInput, { target: { value: "9998887777" } });

        const saveButton = screen.getByRole("button", { name: /Save Staff Updates/i });
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(axios.put).toHaveBeenCalledWith(
                expect.stringContaining("/owner/1/staff/101"),
                expect.objectContaining({
                    name: "Alice Updated",
                    email: "alice@restaurant.com",
                    phone: "9998887777",
                    role: "WAITER",
                    isActive: true,
                })
            );
        });

        // Verifies directory reload is triggered
        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledTimes(2);
        });
    });

    it("6. Edit form does NOT expose existing password, hash, or token", async () => {
        render(
            <StaffDirectoryDrawer
                isOpen={true}
                onClose={vi.fn()}
                restaurantId={1}
            />
        );

        await waitFor(() => {
            expect(screen.getByText("Alice Waiter")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId("edit-staff-101"));

        const passwordInput = screen.getByPlaceholderText(/leave blank to keep current/i);
        expect(passwordInput.value).toBe("");
        expect(passwordInput).toHaveAttribute("type", "password");

        // Toggle show password
        const toggleBtn = screen.getByLabelText("Show password");
        fireEvent.click(toggleBtn);
        expect(passwordInput).toHaveAttribute("type", "text");
        expect(passwordInput.value).toBe("");
    });

    it("7. Existing Copy Link action still works", async () => {
        render(
            <StaffDirectoryDrawer
                isOpen={true}
                onClose={vi.fn()}
                restaurantId={1}
            />
        );

        await waitFor(() => {
            expect(screen.getByText("Alice Waiter")).toBeInTheDocument();
        });

        const copyButtons = screen.getAllByRole("button", { name: /copy link/i });
        fireEvent.click(copyButtons[0]);

        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
            expect.stringContaining("mode=staff&email=alice%40restaurant.com")
        );
    });

    it("8. Existing WhatsApp share action still works", async () => {
        render(
            <StaffDirectoryDrawer
                isOpen={true}
                onClose={vi.fn()}
                restaurantId={1}
            />
        );

        await waitFor(() => {
            expect(screen.getByText("Alice Waiter")).toBeInTheDocument();
        });

        const whatsappButtons = screen.getAllByRole("button", { name: /whatsapp/i });
        fireEvent.click(whatsappButtons[0]);

        expect(window.open).toHaveBeenCalledWith(
            expect.stringContaining("https://api.whatsapp.com/send?text="),
            "_blank"
        );
    });

    it("9. Multiple staff cards open their respective staff member correctly", async () => {
        render(
            <StaffDirectoryDrawer
                isOpen={true}
                onClose={vi.fn()}
                restaurantId={1}
            />
        );

        await waitFor(() => {
            expect(screen.getByText("Alice Waiter")).toBeInTheDocument();
            expect(screen.getByText("Bob Chef")).toBeInTheDocument();
        });

        // Open Alice
        fireEvent.click(screen.getByTestId("edit-staff-101"));
        expect(screen.getByText(/Editing Staff Profile: Alice Waiter/i)).toBeInTheDocument();
        expect(screen.getByText(/ID: #101/i)).toBeInTheDocument();

        // Close Alice modal
        fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
        expect(screen.queryByTestId("staff-edit-modal")).not.toBeInTheDocument();

        // Open Bob
        fireEvent.click(screen.getByTestId("edit-staff-102"));
        expect(screen.getByText(/Editing Staff Profile: Bob Chef/i)).toBeInTheDocument();
        expect(screen.getByText(/ID: #102/i)).toBeInTheDocument();

        const emailInput = screen.getByPlaceholderText(/email address/i);
        expect(emailInput.value).toBe("bob@restaurant.com");
    });

    it("10. Staff Directory drawer remains open during and after edit", async () => {
        const onCloseMock = vi.fn();
        render(
            <StaffDirectoryDrawer
                isOpen={true}
                onClose={onCloseMock}
                restaurantId={1}
            />
        );

        await waitFor(() => {
            expect(screen.getByText("Alice Waiter")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId("edit-staff-101"));
        expect(screen.getByTestId("staff-edit-modal")).toBeInTheDocument();

        // Cancel editing
        fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

        // Modal is closed, but drawer is STILL open!
        expect(screen.queryByTestId("staff-edit-modal")).not.toBeInTheDocument();
        expect(onCloseMock).not.toHaveBeenCalled();
        expect(screen.getByText("Staff Directory")).toBeInTheDocument();
    });
});
