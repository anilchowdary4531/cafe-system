import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import StaffSubNav from "../components/StaffSubNav";
import OwnerStaff from "../pages/admin/OwnerStaff";

vi.mock("axios");
vi.mock("../../utils/toast", () => ({
    showToast: vi.fn(),
}));

const mockStaffList = [
    {
        id: 18,
        name: "john",
        email: "john@example.com",
        phone: "+91 9876543210",
        role: "WAITER",
        designation: "Server",
        isActive: true,
        restaurantId: 1,
        createdAt: "2025-01-01T00:00:00.000Z",
        loginLink: "http://localhost:5173/login?mode=staff&email=john%40example.com",
    },
    {
        id: 17,
        name: "saimohan",
        email: "saimohan@example.com",
        phone: "+91 9876543211",
        role: "STAFF",
        designation: "Cleaner",
        isActive: true,
        restaurantId: 1,
        createdAt: "2025-01-02T00:00:00.000Z",
        loginLink: "http://localhost:5173/login?mode=staff&email=saimohan%40example.com",
    },
    {
        id: 16,
        name: "sharuku",
        email: "sharuku@example.com",
        phone: "+91 9876543212",
        role: "STAFF",
        designation: "Steward",
        isActive: false,
        restaurantId: 1,
        createdAt: "2025-01-03T00:00:00.000Z",
        loginLink: "http://localhost:5173/login?mode=staff&email=sharuku%40example.com",
    },
];

describe("Staff Directory Theme & Contrast Redesign", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.setItem(
            "user",
            JSON.stringify({
                id: 1,
                name: "Owner Test",
                role: "OWNER",
                restaurantId: 1,
                restaurantName: "Cafe King",
            })
        );
        axios.get.mockResolvedValue({
            data: {
                users: mockStaffList,
                modules: ["dashboard", "billing", "orders", "menu", "tables", "kitchen"],
            },
        });
    });

    describe("StaffSubNav Tab Navigation", () => {
        it("renders active and inactive tabs with high-contrast Tiffzy theme styling", () => {
            render(
                <MemoryRouter initialEntries={["/owner/staff"]}>
                    <StaffSubNav />
                </MemoryRouter>
            );

            const staffTab = screen.getByRole("link", { name: /staff directory/i });
            const scheduleTab = screen.getByRole("link", { name: /shift schedules/i });

            // Active tab has Tiffzy orange text and underline
            expect(staffTab.className).toContain("text-[#F97316]");
            expect(staffTab.className).toContain("border-[#F97316]");

            // Inactive tabs have readable dark neutral #57534E
            expect(scheduleTab.className).toContain("text-[#57534E]");
            expect(scheduleTab.className).toContain("hover:text-[#EA580C]");
            expect(scheduleTab.className).toContain("hover:bg-[#FFF7ED]");
        });
    });

    describe("OwnerStaff Directory Page High-Contrast Elements", () => {
        it("renders page header and subtext with high-contrast colors", async () => {
            render(
                <MemoryRouter initialEntries={["/owner/staff"]}>
                    <OwnerStaff />
                </MemoryRouter>
            );

            const heading = await screen.findByRole("heading", { name: /staff directory & access/i });
            expect(heading.className).toContain("text-[#1C1917]");

            const subtext = screen.getByText(/total staff/i);
            expect(subtext.className).toContain("text-[#57534E]");
        });

        it("renders search and filter inputs with white background and visible border", async () => {
            render(
                <MemoryRouter initialEntries={["/owner/staff"]}>
                    <OwnerStaff />
                </MemoryRouter>
            );

            const searchInput = await screen.findByPlaceholderText(/search by name, email, role/i);
            expect(searchInput.parentElement.className).toContain("bg-white");
            expect(searchInput.parentElement.className).toContain("border-[#D6D3D1]");
            expect(searchInput.parentElement.className).toContain("focus-within:border-[#F97316]");
            expect(searchInput.className).toContain("text-[#292524]");
            expect(searchInput.className).toContain("placeholder-[#78716C]");

            const roleSelect = screen.getByRole("combobox", { name: /filter staff by role/i });
            expect(roleSelect.className).toContain("bg-white");
            expect(roleSelect.className).toContain("border-[#D6D3D1]");
            expect(roleSelect.className).toContain("text-[#292524]");

            const statusSelect = screen.getByRole("combobox", { name: /filter staff by active status/i });
            expect(statusSelect.className).toContain("bg-white");
            expect(statusSelect.className).toContain("border-[#D6D3D1]");
            expect(statusSelect.className).toContain("text-[#292524]");
        });

        it("renders Add Staff primary CTA button in vibrant Tiffzy orange", async () => {
            render(
                <MemoryRouter initialEntries={["/owner/staff"]}>
                    <OwnerStaff />
                </MemoryRouter>
            );

            const addStaffBtn = await screen.findByRole("button", { name: /add staff/i });
            expect(addStaffBtn.className).toContain("bg-[#F97316]");
            expect(addStaffBtn.className).toContain("text-white");
            expect(addStaffBtn.className).toContain("hover:bg-[#EA580C]");
        });

        it("renders staff cards with clear borders, near-black names, and role-specific badges", async () => {
            render(
                <MemoryRouter initialEntries={["/owner/staff"]}>
                    <OwnerStaff />
                </MemoryRouter>
            );

            // Wait for staff list to render
            const johnName = await screen.findByText("john");
            expect(johnName.className).toContain("text-[#1C1917]");
            expect(johnName.className).toContain("font-bold");

            // Staff ID badge #18
            const idBadge = screen.getByText("#18");
            expect(idBadge.className).toContain("bg-stone-100");
            expect(idBadge.className).toContain("text-[#57534E]");
            expect(idBadge.className).toContain("border-stone-200");

            // Role badge (Server has light orange bg + dark orange text)
            const serverBadge = screen.getByText("Server");
            expect(serverBadge.className).toContain("bg-orange-50");
            expect(serverBadge.className).toContain("text-orange-800");

            // Status badge (ACTIVE has light green bg + dark green text)
            const activeBadges = screen.getAllByText("ACTIVE");
            expect(activeBadges[0].className).toContain("bg-[#ECFDF5]");
            expect(activeBadges[0].className).toContain("text-[#047857]");
            expect(activeBadges[0].className).toContain("border-[#A7F3D0]");

            // Status badge (DISABLED has red bg + dark red text)
            const disabledBadge = screen.getByText("DISABLED");
            expect(disabledBadge.className).toContain("bg-[#FEF2F2]");
            expect(disabledBadge.className).toContain("text-[#B91C1C]");
            expect(disabledBadge.className).toContain("border-[#FECACA]");
        });

        it("renders Login URL box and action buttons with readable contrast", async () => {
            render(
                <MemoryRouter initialEntries={["/owner/staff"]}>
                    <OwnerStaff />
                </MemoryRouter>
            );

            await screen.findByText("john");

            // Login URL code elements
            const loginUrlCodes = screen.getAllByText(/\/login\?mode=staff/i);
            expect(loginUrlCodes[0].className).toContain("bg-[#F5F5F4]");
            expect(loginUrlCodes[0].className).toContain("border-[#D6D3D1]");
            expect(loginUrlCodes[0].className).toContain("text-[#44403C]");

            // Copy Link buttons
            const copyButtons = screen.getAllByRole("button", { name: /copy link/i });
            expect(copyButtons[0].className).toContain("bg-white");
            expect(copyButtons[0].className).toContain("border-[#D6D3D1]");
            expect(copyButtons[0].className).toContain("text-[#44403C]");

            // WhatsApp buttons
            const whatsappButtons = screen.getAllByRole("button", { name: /whatsapp/i });
            expect(whatsappButtons[0].className).toContain("bg-[#ECFDF5]");
            expect(whatsappButtons[0].className).toContain("border-[#A7F3D0]");
            expect(whatsappButtons[0].className).toContain("text-[#047857]");

            // Edit buttons
            const editButtons = screen.getAllByRole("button", { name: /^edit$/i });
            expect(editButtons[0].className).toContain("bg-[#FFF7ED]");
            expect(editButtons[0].className).toContain("border-[#FDBA74]");
            expect(editButtons[0].className).toContain("text-[#C2410C]");

            // Reset Password buttons
            const resetButtons = screen.getAllByRole("button", { name: /reset password/i });
            expect(resetButtons[0].className).toContain("bg-stone-100");
            expect(resetButtons[0].className).toContain("border-stone-300");
            expect(resetButtons[0].className).toContain("text-[#1C1917]");
        });
    });
});
