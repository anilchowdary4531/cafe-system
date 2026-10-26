import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import axios from "axios";
import OwnerStaff from "../pages/admin/OwnerStaff";

vi.mock("axios");
vi.mock("../../utils/toast", () => ({
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
        loginLink: "http://localhost:5173/login?mode=staff&email=alice%40restaurant.com",
    },
    {
        id: 102,
        name: "Bob Chef",
        email: "bob@restaurant.com",
        phone: "9876543211",
        role: "CHEF",
        designation: "Head Chef",
        isActive: true,
        restaurantId: 1,
        createdAt: "2026-10-11T10:00:00.000Z",
        access: { dashboard: true, kitchen: true, orders: true },
        loginLink: "http://localhost:5173/login?mode=staff&email=bob%40restaurant.com",
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
        loginLink: "http://localhost:5173/login?mode=staff&email=charlie%40restaurant.com",
    },
];

describe("Phase 2 — OwnerStaff Management Component", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.setItem(
            "user",
            JSON.stringify({
                id: 1,
                name: "Owner Test",
                role: "OWNER",
                restaurantId: 1,
                restaurantName: "Tiffzy Grand Cafe",
            })
        );
        axios.get.mockResolvedValue({
            data: {
                users: mockStaffUsers,
                modules: ["dashboard", "billing", "orders", "menu", "tables", "kitchen"],
            },
        });
    });

    it("1. Loads staff directory with Staff ID, Role, Status, and Restaurant info", async () => {
        render(
            <MemoryRouter initialEntries={["/owner/staff"]}>
                <OwnerStaff />
            </MemoryRouter>
        );

        expect(screen.getByTestId("owner-staff")).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText("Alice Waiter")).toBeInTheDocument();
            expect(screen.getByText("Bob Chef")).toBeInTheDocument();
            expect(screen.getByText("Charlie Disabled")).toBeInTheDocument();
        });

        // Verifies Staff ID is rendered
        expect(screen.getByText("#101")).toBeInTheDocument();
        expect(screen.getByText("#102")).toBeInTheDocument();
        expect(screen.getByText("#103")).toBeInTheDocument();

        // Verifies status pills
        expect(screen.getAllByText("ACTIVE").length).toBeGreaterThanOrEqual(2);
        expect(screen.getByText("DISABLED")).toBeInTheDocument();
    });

    it("2. Filters staff directory by search query", async () => {
        render(
            <MemoryRouter initialEntries={["/owner/staff"]}>
                <OwnerStaff />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Alice Waiter")).toBeInTheDocument();
        });

        const searchInput = screen.getByPlaceholderText(/search by name/i);
        fireEvent.change(searchInput, { target: { value: "Bob" } });

        expect(screen.getByText("Bob Chef")).toBeInTheDocument();
        expect(screen.queryByText("Alice Waiter")).not.toBeInTheDocument();
    });

    it("3. Filters staff by role dropdown", async () => {
        render(
            <MemoryRouter initialEntries={["/owner/staff"]}>
                <OwnerStaff />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Alice Waiter")).toBeInTheDocument();
        });

        const roleSelect = screen.getByLabelText(/filter staff by role/i);
        fireEvent.change(roleSelect, { target: { value: "CHEF" } });

        await waitFor(() => {
            expect(screen.getByText("Bob Chef")).toBeInTheDocument();
            expect(screen.queryByText("Alice Waiter")).not.toBeInTheDocument();
        });
    });

    it("4. Filters staff by active/disabled status", async () => {
        render(
            <MemoryRouter initialEntries={["/owner/staff"]}>
                <OwnerStaff />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Alice Waiter")).toBeInTheDocument();
        });

        const statusSelect = screen.getByLabelText(/filter staff by active status/i);
        fireEvent.change(statusSelect, { target: { value: "DISABLED" } });

        await waitFor(() => {
            expect(screen.getByText("Charlie Disabled")).toBeInTheDocument();
            expect(screen.queryByText("Alice Waiter")).not.toBeInTheDocument();
        });
    });

    it("5. Add Staff form opens with masked password field and show/hide toggle", async () => {
        render(
            <MemoryRouter initialEntries={["/owner/staff"]}>
                <OwnerStaff />
            </MemoryRouter>
        );

        const addBtn = screen.getByRole("button", { name: /add staff/i });
        fireEvent.click(addBtn);

        expect(screen.getByText("Add New Staff Member")).toBeInTheDocument();

        const passwordInput = screen.getByPlaceholderText(/auto-generated if left blank/i);
        expect(passwordInput).toHaveAttribute("type", "password");

        // Toggle visibility
        const toggleBtn = screen.getByLabelText("Show password");
        fireEvent.click(toggleBtn);
        expect(passwordInput).toHaveAttribute("type", "text");
    });

    it("6. Auto-generate password helper sets a temporary password", async () => {
        render(
            <MemoryRouter initialEntries={["/owner/staff"]}>
                <OwnerStaff />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByRole("button", { name: /add staff/i }));
        const autoGenBtn = screen.getByRole("button", { name: /auto-generate/i });
        fireEvent.click(autoGenBtn);

        const passwordInput = screen.getByPlaceholderText(/auto-generated if left blank/i);
        expect(passwordInput.value).toMatch(/^Staff#[A-Za-z0-9]+/);
    });

    it("7. Deactivation opens confirmation modal before terminating sessions", async () => {
        render(
            <MemoryRouter initialEntries={["/owner/staff"]}>
                <OwnerStaff />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Alice Waiter")).toBeInTheDocument();
        });

        const moreActionBtns = screen.getAllByLabelText("Open staff actions");
        fireEvent.click(moreActionBtns[0]); // Alice

        const deactivateBtn = screen.getByRole("button", { name: /deactivate \/ disable/i });
        fireEvent.click(deactivateBtn);

        // Confirmation modal must appear
        expect(screen.getByText(/deactivate staff member\?/i)).toBeInTheDocument();
        expect(screen.getByText(/revoke all active login sessions/i)).toBeInTheDocument();
    });

    it("8. Deletion opens confirmation modal before calling backend", async () => {
        render(
            <MemoryRouter initialEntries={["/owner/staff"]}>
                <OwnerStaff />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Alice Waiter")).toBeInTheDocument();
        });

        const moreActionBtns = screen.getAllByLabelText("Open staff actions");
        fireEvent.click(moreActionBtns[0]);

        const deleteBtn = screen.getByRole("button", { name: /delete staff/i });
        fireEvent.click(deleteBtn);

        // Confirmation modal must appear
        expect(screen.getByText(/delete staff member permanently\?/i)).toBeInTheDocument();
        expect(screen.getByText(/historical records/i)).toBeInTheDocument();
    });

    it("9. Safe login link does NOT expose password, hash, or JWT token", async () => {
        render(
            <MemoryRouter initialEntries={["/owner/staff"]}>
                <OwnerStaff />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Alice Waiter")).toBeInTheDocument();
        });

        const loginCodes = screen.getAllByText(/mode=staff/i);
        expect(loginCodes[0].textContent).toContain("email=alice%40restaurant.com");
        expect(loginCodes[0].textContent).not.toContain("token=");
        expect(loginCodes[0].textContent).not.toContain("jwt=");
        expect(loginCodes[0].textContent).not.toContain("password");
    });

    it("10. Add New Staff Member form has NO Initial Module Access Template, retains all core fields, and creates staff", async () => {
        axios.post.mockResolvedValueOnce({
            data: {
                user: { id: 104, name: "David Server", email: "david@restaurant.com", role: "WAITER" },
                temporaryPassword: "Staff#test123",
            },
        });

        render(
            <MemoryRouter initialEntries={["/owner/staff"]}>
                <OwnerStaff />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Alice Waiter")).toBeInTheDocument();
        });

        // 1 & 2: Open Add Staff Form
        fireEvent.click(screen.getByRole("button", { name: /add staff/i }));
        expect(screen.getByText("Add New Staff Member")).toBeInTheDocument();

        // 3: Verify Initial Module Access Template is completely removed
        expect(screen.queryByText(/Initial Module Access Template/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Tables & QR/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Billing Desk/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Kitchen Operations/i)).not.toBeInTheDocument();

        // 4, 5, 6, 7, 8: Verify all required fields remain intact
        expect(screen.getByPlaceholderText(/e\.g\. John Doe/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/e\.g\. john@restaurant\.com/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/e\.g\. 9876543210/i)).toBeInTheDocument();
        expect(screen.getByText("Staff Role *")).toBeInTheDocument();
        expect(screen.getByText("Designation")).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/auto-generated if left blank/i)).toBeInTheDocument();
        expect(screen.getByText("Active Account")).toBeInTheDocument();

        // Fill form and create
        fireEvent.change(screen.getByPlaceholderText(/e\.g\. John Doe/i), { target: { value: "David Server" } });
        fireEvent.change(screen.getByPlaceholderText(/e\.g\. john@restaurant\.com/i), { target: { value: "david@restaurant.com" } });
        fireEvent.change(screen.getByPlaceholderText(/e\.g\. 9876543210/i), { target: { value: "9876543211" } });

        // 9: Create Staff Member works and submits default access payload
        fireEvent.click(screen.getByRole("button", { name: /create staff member/i }));

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("/owner/1/staff"),
                expect.objectContaining({
                    name: "David Server",
                    email: "david@restaurant.com",
                    phone: "9876543211",
                    role: expect.any(String),
                    access: expect.any(Object),
                    isActive: true,
                })
            );
        });
    });
});

