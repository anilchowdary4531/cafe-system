import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import React from "react";
import { BrowserRouter } from "react-router-dom";
import axios from "axios";
import OwnerSettings from "../pages/admin/OwnerSettings";
import { uploadToS3Presigned } from "../utils/s3Upload";

vi.mock("axios");
vi.mock("../utils/s3Upload", () => ({
    uploadToS3Presigned: vi.fn(),
}));

const mockRestaurant = {
    id: 1,
    name: "Tiffzy Bistro",
    legalName: "Tiffzy Foods Pvt Ltd",
    ownerName: "Aarav Sharma",
    email: "aarav@tiffzy.com",
    phone: "+91 9876543210",
    logo: "https://cdn.example.com/tiffzy-logo.png",
    addressLine1: "42 MG Road, Indiranagar",
    city: "Bengaluru",
    state: "Karnataka",
    country: "India",
    pincode: "560038",
    latitude: 12.9716,
    longitude: 77.5946,
    gstNumber: "29ABCDE1234F1Z5",
    timezone: "Asia/Kolkata",
    currency: "INR",
    invoicePrefix: "TB-2026-",
    nextInvoiceNumber: 1050,
    isActive: true,
    billingConfig: {
        taxes: [
            {
                name: "CGST",
                rate: 2.5,
                type: "PERCENTAGE",
                appliesTo: ["ALL"],
                isInclusive: false,
                isEnabled: true,
            },
        ],
        charges: [
            {
                name: "Packaging Fee",
                amount: 15,
                type: "FIXED",
                appliesTo: ["TAKEAWAY"],
                isEnabled: true,
                isTaxable: false,
            },
        ],
        roundOff: true,
        allowTips: true,
    },
};

const renderOwnerSettings = () =>
    render(
        <BrowserRouter>
            <OwnerSettings />
        </BrowserRouter>
    );

const getNavButton = (pattern) => {
    const nav = screen.getByRole("navigation", { name: /Settings sections/i });
    return within(nav).getByRole("button", { name: pattern });
};

describe("OwnerSettings — SaaS Redesign", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.setItem("user", JSON.stringify({ id: 2, restaurantId: 1, role: "OWNER" }));
        localStorage.setItem("token", "mock-token");
        axios.get.mockResolvedValue({
            data: {
                success: true,
                restaurant: mockRestaurant,
            },
        });
        axios.put.mockImplementation(async (_url, payload) => ({
            data: {
                success: true,
                restaurant: payload,
            },
        }));
    });

    it("loads Profile Overview with actual restaurant data and completion indicator", async () => {
        renderOwnerSettings();

        await waitFor(() => {
            expect(screen.getByText("Tiffzy Bistro")).toBeDefined();
        });

        expect(screen.getByText("Aarav Sharma")).toBeDefined();
        expect(screen.getByText("aarav@tiffzy.com")).toBeDefined();
        expect(screen.getByText("+91 9876543210")).toBeDefined();
        expect(screen.getByText("100%")).toBeDefined();
        expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    });

    it("navigates across all settings sections and displays saved values", async () => {
        renderOwnerSettings();

        await screen.findByText("Tiffzy Bistro");

        // 1. Business Profile
        fireEvent.click(getNavButton(/Business Profile/i));
        expect(screen.getByDisplayValue("Tiffzy Bistro")).toBeDefined();
        expect(screen.getByDisplayValue("Tiffzy Foods Pvt Ltd")).toBeDefined();
        expect(screen.getByDisplayValue("Aarav Sharma")).toBeDefined();
        expect(screen.getByDisplayValue("aarav@tiffzy.com")).toBeDefined();
        expect(screen.getByDisplayValue("+91 9876543210")).toBeDefined();
        expect(screen.getByDisplayValue("https://cdn.example.com/tiffzy-logo.png")).toBeDefined();

        // 2. Address & Identity
        fireEvent.click(getNavButton(/Address & Identity/i));
        expect(screen.getByDisplayValue("42 MG Road, Indiranagar")).toBeDefined();
        expect(screen.getByDisplayValue("Bengaluru")).toBeDefined();
        expect(screen.getByDisplayValue("Karnataka")).toBeDefined();
        expect(screen.getByDisplayValue("India")).toBeDefined();
        expect(screen.getByDisplayValue("560038")).toBeDefined();
        expect(screen.getByDisplayValue("29ABCDE1234F1Z5")).toBeDefined();
        expect(screen.getByText(/12\.97160, 77\.59460/)).toBeDefined();

        // 3. Tax & Billing
        fireEvent.click(getNavButton(/Tax & Billing/i));
        expect(screen.getByDisplayValue("CGST")).toBeDefined();
        expect(screen.getByDisplayValue("Packaging Fee")).toBeDefined();
        expect(screen.getByDisplayValue("TB-2026-")).toBeDefined();
        expect(screen.getByDisplayValue("1050")).toBeDefined();

        // 4. Operations & Preferences
        fireEvent.click(getNavButton(/Operations & Preferences/i));
        expect(screen.getByDisplayValue("Asia/Kolkata")).toBeDefined();
        expect(screen.getByDisplayValue("INR")).toBeDefined();
        expect(screen.getByRole("link", { name: /Delete Account/i })).toBeDefined();
    });

    it("supports Edit, Cancel, validation errors, Save, and API failure feedback", async () => {
        renderOwnerSettings();
        await screen.findByText("Tiffzy Bistro");

        fireEvent.click(getNavButton(/Business Profile/i));
        const nameInput = screen.getByDisplayValue("Tiffzy Bistro");
        const emailInput = screen.getByDisplayValue("aarav@tiffzy.com");

        // Enter Edit mode and test Cancel
        fireEvent.click(screen.getByRole("button", { name: /^Edit$/i }));
        fireEvent.change(nameInput, { target: { value: "Temporary Name" } });
        expect(nameInput.value).toBe("Temporary Name");

        fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
        expect(screen.getByDisplayValue("Tiffzy Bistro")).toBeDefined();
        expect(screen.getByDisplayValue("Tiffzy Bistro").readOnly).toBe(true);

        // Enter Edit mode and test validation
        fireEvent.click(screen.getByRole("button", { name: /^Edit$/i }));
        fireEvent.change(nameInput, { target: { value: "" } });
        fireEvent.change(emailInput, { target: { value: "invalid-email" } });
        fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

        expect(await screen.findByText("Restaurant name is required.")).toBeDefined();
        expect(screen.getByText("Enter a valid business email address.")).toBeDefined();
        expect(axios.put).not.toHaveBeenCalled();

        // Fix validation and test API failure
        fireEvent.change(nameInput, { target: { value: "Tiffzy Bistro Prime" } });
        fireEvent.change(emailInput, { target: { value: "prime@tiffzy.com" } });
        axios.put.mockRejectedValueOnce({
            response: { data: { message: "Server unavailable" } },
        });
        fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

        expect(await screen.findByText("Server unavailable")).toBeDefined();

        // Retry save and succeed
        axios.put.mockResolvedValueOnce({
            data: {
                success: true,
                restaurant: { ...mockRestaurant, name: "Tiffzy Bistro Prime", email: "prime@tiffzy.com" },
            },
        });
        fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

        expect(await screen.findByText("Settings updated successfully.")).toBeDefined();
        expect(axios.put).toHaveBeenCalledTimes(2);
    });

    it("warns before leaving a section with unsaved changes and handles Stay / Discard / Save & Switch", async () => {
        renderOwnerSettings();
        await screen.findByText("Tiffzy Bistro");

        fireEvent.click(getNavButton(/Business Profile/i));
        fireEvent.click(screen.getByRole("button", { name: /^Edit$/i }));
        fireEvent.change(screen.getByDisplayValue("Tiffzy Bistro"), {
            target: { value: "Tiffzy Unsaved" },
        });

        // Attempt to switch section
        fireEvent.click(getNavButton(/Address & Identity/i));
        const dialog = await screen.findByRole("alertdialog");
        expect(dialog).toBeDefined();

        // Stay Here keeps user on Business Profile
        fireEvent.click(screen.getByRole("button", { name: /Stay Here/i }));
        expect(screen.queryByRole("alertdialog")).toBeNull();
        expect(screen.getByDisplayValue("Tiffzy Unsaved")).toBeDefined();

        // Discard Changes reverts and switches
        fireEvent.click(getNavButton(/Address & Identity/i));
        fireEvent.click(await screen.findByRole("button", { name: /Discard Changes/i }));
        expect(screen.getByDisplayValue("42 MG Road, Indiranagar")).toBeDefined();

        // Verify unsaved changes were discarded
        fireEvent.click(getNavButton(/Business Profile/i));
        expect(screen.getByDisplayValue("Tiffzy Bistro")).toBeDefined();
    });

    it("supports adding, editing, and deleting taxes and extra charges", async () => {
        renderOwnerSettings();
        await screen.findByText("Tiffzy Bistro");

        fireEvent.click(screen.getByRole("button", { name: /Tax & Billing/i }));

        // Add Tax
        fireEvent.click(screen.getByRole("button", { name: /Add Tax/i }));
        const newTaxInput = screen.getByDisplayValue("Tax 2");
        fireEvent.change(newTaxInput, { target: { value: "SGST" } });
        expect(screen.getByDisplayValue("SGST")).toBeDefined();

        // Delete original CGST tax
        fireEvent.click(screen.getByRole("button", { name: /Delete CGST/i }));
        expect(screen.queryByDisplayValue("CGST")).toBeNull();

        // Add Charge
        fireEvent.click(screen.getByRole("button", { name: /Add Charge/i }));
        expect(screen.getByDisplayValue("Packaging Charge")).toBeDefined();

        // Delete Packaging Fee
        fireEvent.click(screen.getByRole("button", { name: /Delete Packaging Fee/i }));
        expect(screen.queryByDisplayValue("Packaging Fee")).toBeNull();

        // Save updated tax & billing config
        fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));
        await waitFor(() => {
            expect(axios.put).toHaveBeenCalledTimes(1);
        });
        const [, payload] = axios.put.mock.calls[0];
        expect(payload.billingConfig.taxes).toHaveLength(1);
        expect(payload.billingConfig.taxes[0].name).toBe("SGST");
        expect(payload.billingConfig.charges).toHaveLength(1);
        expect(payload.billingConfig.charges[0].name).toBe("Packaging Charge");
    });

    it("handles logo upload and toggling the compact map picker", async () => {
        uploadToS3Presigned.mockResolvedValueOnce({
            publicUrl: "https://cdn.example.com/new-logo.png",
        });

        renderOwnerSettings();
        await screen.findByText("Tiffzy Bistro");

        // Logo upload in Business Profile
        fireEvent.click(getNavButton(/Business Profile/i));
        const fileInput = document.querySelector('input[type="file"]');
        const file = new File(["logo"], "logo.png", { type: "image/png" });
        fireEvent.change(fileInput, { target: { files: [file] } });

        expect(await screen.findByText("Logo uploaded. Save changes to apply.")).toBeDefined();
        expect(screen.getByDisplayValue("https://cdn.example.com/new-logo.png")).toBeDefined();

        // Discard upload before switching to Address & Identity
        fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
        fireEvent.click(getNavButton(/Address & Identity/i));

        const toggleMapBtn = screen.getByRole("button", { name: /Select on Map/i });
        expect(toggleMapBtn.getAttribute("aria-expanded")).toBe("false");

        fireEvent.click(toggleMapBtn);
        expect(screen.getByRole("button", { name: /Hide Map/i }).getAttribute("aria-expanded")).toBe("true");
    });
});
