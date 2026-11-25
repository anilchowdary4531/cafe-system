import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import React from "react";
import { BrowserRouter } from "react-router-dom";
import axios from "axios";
import OwnerSettings from "../pages/admin/OwnerSettings";

vi.mock("axios");
vi.mock("../../utils/s3Upload", () => ({
    uploadToS3Presigned: vi.fn(),
}));

const mockSettings = {
    name: "Cafe King",
    legalName: "Cafe King Pvt Ltd",
    ownerName: "Anil Kumar",
    email: "owner@cafeking.com",
    phone: "9999999999",
    logo: "https://example.com/logo.png",
    addressLine1: "Street, area, landmark",
    city: "Bangalore",
    state: "Karnataka",
    country: "India",
    pincode: "560001",
    gstNumber: "29ABCDE1234F1Z5",
    timezone: "Asia/Kolkata",
    currency: "INR",
    isActive: true,
    billingConfig: {
        taxes: [
            { name: "GST", rate: 5, type: "PERCENTAGE", appliesTo: "ALL", isInclusive: false, isEnabled: true }
        ],
        charges: [],
        roundOff: true,
        allowTips: true,
    },
};

describe("OwnerSettings — SaaS Input Styling & Section Verification", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.setItem("user", JSON.stringify({ id: 2, restaurantId: 1, role: "OWNER" }));
        localStorage.setItem("token", "mock-token");
        axios.get.mockResolvedValue({
            data: {
                success: true,
                restaurant: mockSettings,
            },
        });
    });

    it("verifies Business Profile and Address inputs use clean SaaS rounded borders without underline-only styling", async () => {
        render(
            <BrowserRouter>
                <OwnerSettings />
            </BrowserRouter>
        );

        const nav = await screen.findByRole("navigation", { name: /Settings sections/i });
        const businessTab = within(nav).getByRole("button", { name: /Business Profile/i });
        fireEvent.click(businessTab);

        await waitFor(() => {
            expect(screen.getByDisplayValue("Cafe King")).toBeDefined();
        });

        const businessInputs = [
            screen.getByDisplayValue("Cafe King"),
            screen.getByDisplayValue("Cafe King Pvt Ltd"),
            screen.getByDisplayValue("Anil Kumar"),
            screen.getByDisplayValue("owner@cafeking.com"),
            screen.getByDisplayValue("9999999999"),
            screen.getByDisplayValue("https://example.com/logo.png"),
        ];

        businessInputs.forEach((el) => {
            expect(el.className).not.toContain("border-b ");
            expect(el.className).not.toContain("underline");
            expect(el.className).toContain("rounded-lg");
            expect(el.className).toContain("border");
        });

        const addressTab = screen.getByRole("button", { name: /Address & Identity/i });
        fireEvent.click(addressTab);

        await waitFor(() => {
            expect(screen.getByDisplayValue("Bangalore")).toBeDefined();
        });

        const addressInputs = [
            screen.getByDisplayValue("Street, area, landmark"),
            screen.getByDisplayValue("Bangalore"),
            screen.getByDisplayValue("Karnataka"),
            screen.getByDisplayValue("India"),
            screen.getByDisplayValue("560001"),
            screen.getByDisplayValue("29ABCDE1234F1Z5"),
        ];

        addressInputs.forEach((el) => {
            expect(el.className).not.toContain("border-b ");
            expect(el.className).not.toContain("underline");
            expect(el.className).toContain("rounded-lg");
            expect(el.className).toContain("border");
        });
    });

    it("verifies Business Profile inputs become editable when Edit is clicked", async () => {
        render(
            <BrowserRouter>
                <OwnerSettings />
            </BrowserRouter>
        );

        const nav = await screen.findByRole("navigation", { name: /Settings sections/i });
        const businessTab = within(nav).getByRole("button", { name: /Business Profile/i });
        fireEvent.click(businessTab);

        const restaurantNameInput = await screen.findByDisplayValue("Cafe King");
        expect(restaurantNameInput.readOnly).toBe(true);

        fireEvent.click(screen.getByRole("button", { name: /^Edit$/i }));
        expect(restaurantNameInput.readOnly).toBe(false);

        fireEvent.change(restaurantNameInput, { target: { value: "Cafe King Updated" } });
        expect(restaurantNameInput.value).toBe("Cafe King Updated");
    });

    it("verifies Tax & Billing Configuration panel borders are preserved", async () => {
        render(
            <BrowserRouter>
                <OwnerSettings />
            </BrowserRouter>
        );

        const taxTab = await screen.findByRole("button", { name: /Tax & Billing/i });
        fireEvent.click(taxTab);

        await waitFor(() => {
            expect(screen.getByDisplayValue("GST")).toBeDefined();
        });

        const taxNameInput = screen.getByDisplayValue("GST");
        expect(taxNameInput.className).toContain("border");
        expect(taxNameInput.className).toContain("rounded");
        expect(taxNameInput.className).not.toContain("border-b-only");
    });
});
