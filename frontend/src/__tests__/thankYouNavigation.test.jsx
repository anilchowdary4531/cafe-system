import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import ThankYou from "../pages/ThankYou";
import { RestaurantContextProvider } from "../context/RestaurantContext";

describe("Order Thank-You Page Continue Ordering Navigation Audit", () => {
    it("navigates to customer home '/' when Continue Ordering is clicked for Cafe Fido order", () => {
        render(
            <MemoryRouter
                initialEntries={[
                    "/orders/thank-you?slug=cafe-fido&orderNo=INV-1001&status=SUCCESS&amount=450&paymentMode=ONLINE"
                ]}
            >
                <RestaurantContextProvider>
                    <ThankYou />
                </RestaurantContextProvider>
            </MemoryRouter>
        );

        const continueBtn = screen.getByRole("link", { name: /continue ordering/i });
        expect(continueBtn).toBeInTheDocument();
        expect(continueBtn).toHaveAttribute("href", "/");
        expect(continueBtn.getAttribute("href")).not.toContain("cafe-fido");
        expect(continueBtn.getAttribute("href")).not.toContain("/r/");
    });

    it("navigates to customer home '/' when Continue Ordering is clicked for any other restaurant order", () => {
        render(
            <MemoryRouter
                initialEntries={[
                    "/orders/thank-you?slug=ghuma-ghumalu&orderNo=INV-2002&status=SUCCESS&amount=320&paymentMode=ONLINE"
                ]}
            >
                <RestaurantContextProvider>
                    <ThankYou />
                </RestaurantContextProvider>
            </MemoryRouter>
        );

        const continueBtn = screen.getByRole("link", { name: /continue ordering/i });
        expect(continueBtn).toBeInTheDocument();
        expect(continueBtn).toHaveAttribute("href", "/");
        expect(continueBtn.getAttribute("href")).not.toContain("ghuma-ghumalu");
        expect(continueBtn.getAttribute("href")).not.toContain("/r/");
    });

    it("navigates to customer home '/' when Continue Ordering is clicked for order without slug", () => {
        render(
            <MemoryRouter
                initialEntries={[
                    "/orders/thank-you?orderNo=INV-3003&status=SUCCESS&amount=150"
                ]}
            >
                <RestaurantContextProvider>
                    <ThankYou />
                </RestaurantContextProvider>
            </MemoryRouter>
        );

        const continueBtn = screen.getByRole("link", { name: /continue ordering/i });
        expect(continueBtn).toBeInTheDocument();
        expect(continueBtn).toHaveAttribute("href", "/");
    });

    it("keeps Try Payment Again destination to restaurant menu when payment failed", () => {
        render(
            <MemoryRouter
                initialEntries={[
                    "/orders/thank-you?slug=cafe-fido&orderNo=INV-1001&status=FAILED&amount=450"
                ]}
            >
                <RestaurantContextProvider>
                    <ThankYou />
                </RestaurantContextProvider>
            </MemoryRouter>
        );

        const retryBtn = screen.getByRole("link", { name: /try payment again/i });
        expect(retryBtn).toBeInTheDocument();
        expect(retryBtn.getAttribute("href")).toContain("/r/cafe-fido/menu");
    });
});
