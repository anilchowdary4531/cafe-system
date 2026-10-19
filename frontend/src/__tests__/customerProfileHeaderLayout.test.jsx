import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import CustomerProfileHeader from "../components/CustomerProfileHeader";

describe("CustomerProfileHeader - Logo Beside Profile Photo Layout", () => {
    it("renders profile photo on the left, Tiffzy logo + name beside it, and Guest + phone stacked underneath", () => {
        const { container } = render(
            <MemoryRouter>
                <CustomerProfileHeader
                    isOverview={true}
                    title="Guest"
                    subtitle="919999999999"
                    phone="919999999999"
                />
            </MemoryRouter>
        );

        // Header element exists
        const header = container.querySelector("header");
        expect(header).toBeInTheDocument();

        // Profile photo container on the left
        const avatarContainer = container.querySelector(".rounded-2xl.bg-orange-500\\/10");
        expect(avatarContainer).toBeInTheDocument();

        // Tiffzy brand link containing logo + "Tiffzy" text
        const brandLink = screen.getByRole("link", { name: /^tiffzy$/i });
        expect(brandLink).toBeInTheDocument();
        expect(brandLink).toHaveAttribute("href", "/");

        const brandText = screen.getByText("Tiffzy");
        expect(brandText).toBeInTheDocument();

        // Guest name underneath brand row
        const guestName = screen.getByRole("heading", { level: 1, name: "Guest" });
        expect(guestName).toBeInTheDocument();

        // Phone number underneath Guest
        const phone = screen.getByText("919999999999");
        expect(phone).toBeInTheDocument();

        // Ensure both brand row and profile info reside in the info column beside the avatar
        const infoColumn = guestName.parentElement;
        expect(infoColumn).toContainElement(brandLink);
        expect(infoColumn).toContainElement(guestName);
        expect(infoColumn).toContainElement(phone);

        // Outer container flexes avatar and infoColumn side by side with gap
        const parentFlex = avatarContainer.parentElement;
        expect(parentFlex).toContainElement(avatarContainer);
        expect(parentFlex).toContainElement(infoColumn);
        expect(parentFlex.className).toContain("flex");
        expect(parentFlex.className).toContain("items-start");
    });
});
