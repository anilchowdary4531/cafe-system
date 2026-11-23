import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

describe("OwnerSettings — Input Underline Removal Verification", () => {
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

    it("verifies all Business Profile and Address inputs have no bottom-border or underline classes", async () => {
        render(
            <BrowserRouter>
                <OwnerSettings />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByDisplayValue("Cafe King")).toBeDefined();
        });

        // 1. Business Profile inputs
        const restaurantName = screen.getByDisplayValue("Cafe King");
        const legalName = screen.getByDisplayValue("Cafe King Pvt Ltd");
        const ownerName = screen.getByDisplayValue("Anil Kumar");
        const email = screen.getByDisplayValue("owner@cafeking.com");
        const phone = screen.getByDisplayValue("9999999999");
        const logoUrl = screen.getByDisplayValue("https://example.com/logo.png");

        // 2. Address & Identity inputs
        const address = screen.getByDisplayValue("Street, area, landmark");
        const city = screen.getByDisplayValue("Bangalore");
        const state = screen.getByDisplayValue("Karnataka");
        const country = screen.getByDisplayValue("India");
        const pincode = screen.getByDisplayValue("560001");
        const gstNumber = screen.getByDisplayValue("29ABCDE1234F1Z5");

        const testInputs = [
            { name: "Restaurant Name", el: restaurantName },
            { name: "Legal Name", el: legalName },
            { name: "Owner Name", el: ownerName },
            { name: "Business Email", el: email },
            { name: "Business Phone", el: phone },
            { name: "Logo URL", el: logoUrl },
            { name: "Address Line", el: address },
            { name: "City", el: city },
            { name: "State", el: state },
            { name: "Country", el: country },
            { name: "Pincode", el: pincode },
            { name: "GST Number", el: gstNumber },
        ];

        testInputs.forEach(({ name, el }) => {
            // Must NOT have border-b or underline styling
            expect(el.className, `${name} should not have border-b`).not.toContain("border-b");
            expect(el.className, `${name} should not have border-stone-300`).not.toContain("border-stone-300");
            expect(el.className, `${name} should not have focus:border-stone-800`).not.toContain("focus:border-stone-800");
            expect(el.className, `${name} should not have underline`).not.toContain("underline");

            // Must have border-none or border-0
            expect(el.className, `${name} should have border-none`).toContain("border-none");
            expect(el.className, `${name} should have border-0`).toContain("border-0");

            // Must preserve typography and transparent background
            expect(el.className, `${name} should preserve font-bold`).toContain("font-bold");
            expect(el.className, `${name} should preserve bg-transparent`).toContain("bg-transparent");
            expect(el.className, `${name} should preserve text-stone-900`).toContain("text-stone-900");
        });
    });

    it("verifies inputs remain editable without reappearing underlines on focus or change", async () => {
        render(
            <BrowserRouter>
                <OwnerSettings />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByDisplayValue("Cafe King")).toBeDefined();
        });

        const restaurantNameInput = screen.getByDisplayValue("Cafe King");
        fireEvent.focus(restaurantNameInput);
        expect(restaurantNameInput.className).not.toContain("border-b");
        expect(restaurantNameInput.className).toContain("focus:border-none");

        fireEvent.change(restaurantNameInput, { target: { value: "Cafe King Updated" } });
        expect(restaurantNameInput.value).toBe("Cafe King Updated");
        expect(restaurantNameInput.className).not.toContain("border-b");
    });

    it("verifies Tax & Billing Configuration panel borders are preserved", async () => {
        render(
            <BrowserRouter>
                <OwnerSettings />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByDisplayValue("GST")).toBeDefined();
        });

        const taxNameInput = screen.getByDisplayValue("GST");
        // Tax inputs have bordered box styling (rounded border border-stone-200)
        expect(taxNameInput.className).toContain("border");
        expect(taxNameInput.className).toContain("rounded");
        expect(taxNameInput.className).not.toContain("border-b-only");
    });
});
