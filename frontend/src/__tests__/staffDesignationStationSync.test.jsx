import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import OwnerStaff from "../pages/admin/OwnerStaff";
import {
    resolveEffectiveStaffRole,
    getStaffRedirectPath,
    inferRoleFromDesignation,
    mapDesignationToSystemRole,
} from "../utils/staffRole";

vi.mock("axios");
vi.mock("../../utils/toast", () => ({
    showToast: vi.fn(),
}));

const mockSwiperEmployee = {
    id: 42,
    name: "Alex Johnson",
    email: "alex@example.com",
    phone: "+91 9876543210",
    role: "STAFF",
    designation: "Swiper",
    isActive: true,
    restaurantId: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    loginLink: "http://localhost:5173/login?mode=staff&email=alex%40example.com",
};

describe("Staff Designation & Operational Station Synchronization", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.setItem(
            "user",
            JSON.stringify({
                id: 1,
                name: "Owner Test",
                role: "OWNER",
                restaurantId: 1,
                restaurant: { id: 1, name: "Tiffzy Demo Cafe" },
            })
        );
        localStorage.setItem("token", "mock-owner-token");
        localStorage.setItem("restaurantId", "1");
    });

    describe("1. Canonical Role Resolution & Operational Routing Logic", () => {
        it("maps SWIPER designation to canonical STAFF role and routes to /staff/swiper", () => {
            expect(mapDesignationToSystemRole("Swiper")).toBe("STAFF");
            expect(inferRoleFromDesignation("Swiper")).toBe("SWIPER");
            expect(resolveEffectiveStaffRole("STAFF", "Swiper")).toBe("SWIPER");
            expect(getStaffRedirectPath("STAFF", "Swiper")).toBe("/staff/swiper");
        });

        it("maps CLEANER designation to canonical STAFF role and routes to /staff/cleaner", () => {
            expect(mapDesignationToSystemRole("Cleaner")).toBe("STAFF");
            expect(inferRoleFromDesignation("Cleaner")).toBe("CLEANER");
            expect(resolveEffectiveStaffRole("STAFF", "Cleaner")).toBe("CLEANER");
            expect(getStaffRedirectPath("STAFF", "Cleaner")).toBe("/staff/cleaner");
        });

        it("maps SERVER and STEWARD designations to WAITER role", () => {
            expect(mapDesignationToSystemRole("Server")).toBe("WAITER");
            expect(mapDesignationToSystemRole("Steward")).toBe("WAITER");
            expect(getStaffRedirectPath("WAITER", "Server")).toBe("/server");
            expect(getStaffRedirectPath("WAITER", "Steward")).toBe("/staff/steward");
        });

        it("authoritatively overrides stale SWIPER role when designation changes to Cleaner", () => {
            expect(mapDesignationToSystemRole("Cleaner")).toBe("STAFF");
            expect(resolveEffectiveStaffRole("SWIPER", "Cleaner")).toBe("CLEANER");
            expect(getStaffRedirectPath("SWIPER", "Cleaner")).toBe("/staff/cleaner");
        });

        it("authoritatively overrides stale CLEANER role when designation changes to Swiper", () => {
            expect(mapDesignationToSystemRole("Swiper")).toBe("STAFF");
            expect(resolveEffectiveStaffRole("CLEANER", "Swiper")).toBe("SWIPER");
            expect(getStaffRedirectPath("CLEANER", "Swiper")).toBe("/staff/swiper");
        });

        it("preserves administrative OWNER and SUPER_ADMIN roles regardless of designation", () => {
            expect(resolveEffectiveStaffRole("OWNER", "Cleaner")).toBe("OWNER");
            expect(resolveEffectiveStaffRole("SUPER_ADMIN", "Cleaner")).toBe("SUPER_ADMIN");
        });

        it("supports repeated designation transitions dynamically for any employee", () => {
            let designation = "Swiper";
            let role = mapDesignationToSystemRole(designation);
            expect(role).toBe("STAFF");
            expect(getStaffRedirectPath(role, designation)).toBe("/staff/swiper");

            // Transition 1: SWIPER -> CLEANER
            designation = "Cleaner";
            role = mapDesignationToSystemRole(designation);
            expect(role).toBe("STAFF");
            expect(getStaffRedirectPath(role, designation)).toBe("/staff/cleaner");

            // Transition 2: CLEANER -> SWIPER
            designation = "Swiper";
            role = mapDesignationToSystemRole(designation);
            expect(role).toBe("STAFF");
            expect(getStaffRedirectPath(role, designation)).toBe("/staff/swiper");

            // Transition 3: SWIPER -> SERVER
            designation = "Server";
            role = mapDesignationToSystemRole(designation);
            expect(role).toBe("WAITER");
            expect(getStaffRedirectPath(role, designation)).toBe("/server");

            // Transition 4: SERVER -> CLEANER
            designation = "Cleaner";
            role = mapDesignationToSystemRole(designation);
            expect(role).toBe("STAFF");
            expect(getStaffRedirectPath(role, designation)).toBe("/staff/cleaner");
        });
    });

    describe("2. Owner Staff Directory Card Badges & Edit Flow", () => {
        it("displays initial Swiper badges and updates immediately to Cleaner upon save", async () => {
            let currentStaff = [{ ...mockSwiperEmployee }];

            axios.get.mockImplementation(() =>
                Promise.resolve({
                    data: {
                        users: currentStaff,
                        modules: ["dashboard", "staff"],
                    },
                })
            );

            axios.put.mockImplementation((url, payload) => {
                currentStaff = [
                    {
                        ...currentStaff[0],
                        ...payload,
                    },
                ];
                return Promise.resolve({
                    data: {
                        message: "Staff user updated",
                        user: currentStaff[0],
                    },
                });
            });

            render(
                <MemoryRouter>
                    <OwnerStaff />
                </MemoryRouter>
            );

            // Wait for initial load
            await waitFor(() => {
                expect(screen.getByText("Alex Johnson")).toBeInTheDocument();
            });

            // Initially shows Swiper designation badge and ACTIVE
            const swiperBadges = screen.getAllByText("Swiper");
            expect(swiperBadges.length).toBeGreaterThanOrEqual(1);
            expect(screen.getByText("ACTIVE")).toBeInTheDocument();

            // Click Edit button directly on card
            const editBtn = screen.getByRole("button", { name: /^Edit$/i });
            fireEvent.click(editBtn);

            // Verify in-place edit form opened
            expect(screen.getByText(/Editing Staff Profile: Alex Johnson/i)).toBeInTheDocument();

            // Find designation select and change to "Cleaner"
            const designationSelect = screen.getByRole("combobox", { name: /^Designation$/i });
            fireEvent.change(designationSelect, { target: { value: "Cleaner" } });

            // Click Save Staff Updates
            const saveBtn = screen.getByRole("button", { name: /Save Staff Updates/i });
            fireEvent.click(saveBtn);

            // Verify PUT payload sent role: "STAFF" and designation: "Cleaner"
            await waitFor(() => {
                expect(axios.put).toHaveBeenCalledWith(
                    expect.stringContaining(`/owner/1/staff/${mockSwiperEmployee.id}`),
                    expect.objectContaining({
                        designation: "Cleaner",
                        role: "STAFF",
                    })
                );
            });

            // Verify the card now displays Cleaner and ACTIVE, and stale SWIPER is completely gone
            await waitFor(() => {
                const cleanerMatches = screen.getAllByText("Cleaner");
                expect(cleanerMatches.length).toBeGreaterThanOrEqual(1);
                expect(screen.getByText("ACTIVE")).toBeInTheDocument();
                expect(screen.queryByText("SWIPER")).not.toBeInTheDocument();
            });
        });
    });
});
