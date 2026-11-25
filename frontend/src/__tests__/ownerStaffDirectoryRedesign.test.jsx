import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import OwnerStaff from "../pages/admin/OwnerStaff";

vi.mock("axios");

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({
        user: {
            id: 1,
            role: "OWNER",
            restaurantId: 10,
            restaurant: { id: 10, name: "Tiffzy Kitchen" },
        },
    }),
}));

vi.mock("../utils/toast", () => ({
    showToast: vi.fn(),
}));

const mockUsers = [
    {
        id: 101,
        name: "Aarav Mehta",
        email: "aarav@tiffzy.com",
        phone: "9876543210",
        role: "MANAGER",
        designation: "Manager",
        staffType: "Full-Time",
        branchName: "Indiranagar Branch",
        photoUrl: "https://cdn.example.com/aarav.png",
        isActive: true,
        createdAt: "2026-01-15T10:00:00.000Z",
    },
    {
        id: 102,
        name: "Priya Nair",
        email: "priya@tiffzy.com",
        phone: "9123456780",
        role: "CHEF",
        designation: "Senior Chef",
        isActive: true,
        createdAt: "2026-02-20T10:00:00.000Z",
    },
    {
        id: 103,
        name: "Rohan Das",
        email: "rohan@tiffzy.com",
        phone: "9988776655",
        role: "WAITER",
        designation: "Server",
        isActive: false,
        createdAt: "2026-03-10T10:00:00.000Z",
    },
];

const renderDirectory = () =>
    render(
        <MemoryRouter initialEntries={["/owner/staff"]}>
            <OwnerStaff />
        </MemoryRouter>
    );

describe("OwnerStaff — Staff Directory SaaS Grid Redesign", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.setItem(
            "user",
            JSON.stringify({
                id: 1,
                role: "OWNER",
                restaurantId: 10,
                restaurant: { id: 10, name: "Tiffzy Kitchen" },
            })
        );
        Object.assign(navigator, {
            clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
        });
        window.open = vi.fn().mockReturnValue({});
        window.confirm = vi.fn().mockReturnValue(true);

        axios.get.mockResolvedValue({
            data: {
                users: mockUsers,
                modules: ["dashboard", "orders", "kitchen", "staff"],
            },
        });
    });

    it("preserves all 4 staff navigation tabs and renders the compact overview row", async () => {
        renderDirectory();

        expect(screen.getByRole("link", { name: /Staff Directory/i })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /Shift Schedules/i })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /Attendance & Time Clock/i })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /Tasks & Checklists/i })).toBeInTheDocument();

        expect(await screen.findByTestId("staff-total-count")).toHaveTextContent("3");
        expect(screen.getByTestId("staff-active-count")).toHaveTextContent("2");
        expect(screen.getByTestId("staff-inactive-count")).toHaveTextContent("1");
    });

    it("renders responsive 4-column card grid with photo/initials, metadata, and no exposed passwords", async () => {
        renderDirectory();

        const grid = await screen.findByTestId("staff-directory-grid");
        expect(grid.className).toContain("grid-cols-1");
        expect(grid.className).toContain("sm:grid-cols-2");
        expect(grid.className).toContain("lg:grid-cols-3");
        expect(grid.className).toContain("xl:grid-cols-4");

        // Card 1: Photo, staffType, branchName
        const card1 = screen.getByTestId("staff-card-101");
        expect(within(card1).getByAltText("Aarav Mehta")).toHaveAttribute(
            "src",
            "https://cdn.example.com/aarav.png"
        );
        expect(within(card1).getByText("#101")).toBeInTheDocument();
        expect(within(card1).getByText("Full-Time")).toBeInTheDocument();
        expect(within(card1).getByText("Indiranagar Branch")).toBeInTheDocument();
        expect(within(card1).getByText("aarav@tiffzy.com")).toBeInTheDocument();
        expect(within(card1).getByText("9876543210")).toBeInTheDocument();
        expect(within(card1).getByText("ACTIVE")).toBeInTheDocument();
        expect(within(card1).getByText("••••••••••")).toBeInTheDocument();

        // Card 2: Initials fallback when photoUrl is absent
        const card2 = screen.getByTestId("staff-card-102");
        expect(within(card2).getByText("PN")).toBeInTheDocument();
        expect(within(card2).getByText("Senior Chef")).toBeInTheDocument();
        expect(within(card2).getByText("Tiffzy Kitchen")).toBeInTheDocument();

        // Card 3: Disabled status
        const card3 = screen.getByTestId("staff-card-103");
        expect(within(card3).getByText("DISABLED")).toBeInTheDocument();
    });

    it("supports search by name, email, role, or staff ID combined with role and status filters", async () => {
        renderDirectory();
        await screen.findByTestId("staff-directory-grid");

        const searchInput = screen.getByPlaceholderText(/Search by name, email, role, or ID/i);

        // Search by staff ID
        fireEvent.change(searchInput, { target: { value: "102" } });
        expect(screen.queryByTestId("staff-card-101")).toBeNull();
        expect(screen.getByTestId("staff-card-102")).toBeInTheDocument();
        expect(screen.queryByTestId("staff-card-103")).toBeNull();

        // Clear search and combine role + status filters
        fireEvent.change(searchInput, { target: { value: "" } });
        fireEvent.change(screen.getByRole("combobox", { name: /Filter staff by role/i }), {
            target: { value: "WAITER" },
        });
        fireEvent.change(screen.getByRole("combobox", { name: /Filter staff by active status/i }), {
            target: { value: "DISABLED" },
        });

        await waitFor(() => {
            expect(screen.getByTestId("staff-card-103")).toBeInTheDocument();
            expect(screen.queryByTestId("staff-card-101")).toBeNull();
        });

        // Combined filter with no match shows empty state and Reset All Filters
        fireEvent.change(screen.getByRole("combobox", { name: /Filter staff by active status/i }), {
            target: { value: "ACTIVE" },
        });

        expect(await screen.findByText("No Staff Matching Filters")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /Reset All Filters/i }));
        expect(await screen.findByTestId("staff-card-101")).toBeInTheDocument();
    });

    it("renders loading and API error states cleanly", async () => {
        let rejectFetch;
        axios.get.mockImplementationOnce(
            () =>
                new Promise((_resolve, reject) => {
                    rejectFetch = reject;
                })
        );

        renderDirectory();
        expect(screen.getByText("Loading staff directory...")).toBeInTheDocument();

        rejectFetch({ response: { data: { message: "Unable to reach server" } } });
        expect(await screen.findByText("Unable to reach server")).toBeInTheDocument();
    });

    it("keeps overflow menu keyboard-dismissible and wires Copy Link, WhatsApp, Generate Login Link, Reset Password, and Edit", async () => {
        axios.post.mockImplementation(async (url) => {
            if (url.includes("/login-link")) {
                return {
                    data: {
                        loginUrl: "https://app.tiffzy.com/login?mode=staff&token=tok123",
                        token: "tok123",
                        expiresAt: new Date(Date.now() + 600000).toISOString(),
                    },
                };
            }
            return {
                data: {
                    temporaryPassword: "Staff#Temp99",
                },
            };
        });

        renderDirectory();
        const card1 = await screen.findByTestId("staff-card-101");

        // Overflow menu opens and closes on Escape
        const menuBtn = within(card1).getByRole("button", { name: /Open staff actions/i });
        fireEvent.click(menuBtn);
        expect(menuBtn.getAttribute("aria-expanded")).toBe("true");
        expect(screen.getByRole("button", { name: /Permissions Matrix/i })).toBeInTheDocument();

        fireEvent.keyDown(document, { key: "Escape" });
        expect(menuBtn.getAttribute("aria-expanded")).toBe("false");

        // Copy Link & WhatsApp
        fireEvent.click(within(card1).getByRole("button", { name: /Copy Link/i }));
        await waitFor(() => {
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
                expect.stringContaining("/login?mode=staff")
            );
        });

        fireEvent.click(within(card1).getByRole("button", { name: /WhatsApp/i }));
        expect(window.open).toHaveBeenCalledWith(
            expect.stringContaining("https://api.whatsapp.com/send?text="),
            "_blank",
            "noopener,noreferrer"
        );

        // Generate Login Link
        fireEvent.click(screen.getByTestId("generate-login-link-101"));
        expect(await screen.findByTestId("login-link-container-101")).toBeInTheDocument();

        // Reset Password
        fireEvent.click(within(card1).getByRole("button", { name: /Reset Password/i }));
        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("/owner/10/staff/101/temp-password")
            );
        });
        expect(await screen.findByText("Temporary Password Created")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /I Have Shared \/ Saved This Password/i }));

        // Edit
        fireEvent.click(within(card1).getByRole("button", { name: /^Edit$/i }));
        expect(screen.getByText(/Editing Staff Profile: Aarav Mehta/i)).toBeInTheDocument();
    });
});
