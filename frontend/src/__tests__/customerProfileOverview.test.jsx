import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import Profile from "../pages/Profile";
import Navbar from "../components/Navbar";
import { LanguageProvider } from "../context/LanguageContext";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({
        user: null,
        customer: { id: "cust_123", phone: "9876543210" },
        staffToken: null,
    }),
}));

vi.mock("../hooks/useCustomerProfile", () => ({
    default: () => ({
        profile: {
            name: "Ramesh Nanda",
            email: "rameshnanda485@gmail.com",
            phone: "9876543210",
            rewardPoints: 120,
        },
        customerToken: "fake_token",
        loading: false,
        saving: false,
        error: null,
        updateProfile: vi.fn(),
        setError: vi.fn(),
    }),
}));

vi.mock("../hooks/useCachedGet", () => ({
    default: (url) => {
        if (url === "/api/wallet") {
            return {
                data: { wallet: { balance: 3500, currency: "INR", status: "ACTIVE" } },
                loading: false,
                error: null,
            };
        }
        if (url === "/customer/orders") {
            return {
                data: {
                    groups: [
                        {
                            restaurant: { name: "Ghuma Ghumalu", slug: "ghuma-ghumalu" },
                            orders: [
                                {
                                    id: "order_1",
                                    orderNo: "INV-101",
                                    createdAt: "2026-10-11T16:22:08Z",
                                    status: "PLACED",
                                    tableNo: "Takeaway",
                                    total: 284,
                                },
                            ],
                        },
                    ],
                },
                loading: false,
                error: null,
            };
        }
        return { data: null, loading: false, error: null };
    },
}));

describe("Customer Profile Overview Page Redesign Audit", () => {
    it("renders profile header without outer boxed container", () => {
        render(
            <MemoryRouter initialEntries={["/profile/overview?scope=customer"]}>
                <Profile section="overview" />
            </MemoryRouter>
        );

        expect(screen.getByText("Ramesh Nanda")).toBeInTheDocument();
        expect(screen.getByText("rameshnanda485@gmail.com")).toBeInTheDocument();
    });

    it("renders borderless navigation items with titles and captions", () => {
        render(
            <MemoryRouter initialEntries={["/profile/overview?scope=customer"]}>
                <Profile section="overview" />
            </MemoryRouter>
        );

        expect(screen.getByText("Wallet")).toBeInTheDocument();
        expect(screen.getByText("Prepaid balance & top-up")).toBeInTheDocument();

        expect(screen.getByText("Edit profile")).toBeInTheDocument();
        expect(screen.getByText("Photo, name, number")).toBeInTheDocument();

        expect(screen.getByText("Address")).toBeInTheDocument();
        expect(screen.getByText("Saved delivery locations")).toBeInTheDocument();

        expect(screen.getByText("Favorites")).toBeInTheDocument();
        expect(screen.getByText("Your liked dishes")).toBeInTheDocument();

        expect(screen.getByText("Pay Later")).toBeInTheDocument();
        expect(screen.getByText("Manage restaurant credits")).toBeInTheDocument();

        expect(screen.getByText("Notifications")).toBeInTheDocument();
        expect(screen.getByText("View updates & alerts")).toBeInTheDocument();

        expect(screen.getByText("Settings")).toBeInTheDocument();
        expect(screen.getByText("Profile preferences")).toBeInTheDocument();
    });

    it("renders recent orders and order history action", () => {
        render(
            <MemoryRouter initialEntries={["/profile/overview?scope=customer"]}>
                <Profile section="overview" />
            </MemoryRouter>
        );

        expect(screen.getByText(/recent orders/i)).toBeInTheDocument();
        expect(screen.getByText("Latest activity")).toBeInTheDocument();
        expect(screen.getByText("Order History")).toBeInTheDocument();
        expect(screen.getByText("Ghuma Ghumalu")).toBeInTheDocument();
        expect(screen.getByText(/Order #INV-101/i)).toBeInTheDocument();
    });

    it("renders wallet preview with Manage Wallet action", () => {
        render(
            <MemoryRouter initialEntries={["/profile/overview?scope=customer"]}>
                <Profile section="overview" />
            </MemoryRouter>
        );

        expect(screen.getByText(/wallet preview/i)).toBeInTheDocument();
        expect(screen.getByText("Rewards & Wallet")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /Manage Wallet/i })).toBeInTheDocument();

        expect(screen.getByText("Wallet balance")).toBeInTheDocument();
        expect(screen.getByText("Rs 3500.00")).toBeInTheDocument();

        expect(screen.getByText("Reward points")).toBeInTheDocument();
        expect(screen.getByText("120")).toBeInTheDocument();

        expect(screen.getByText("Offers")).toBeInTheDocument();
        expect(screen.getAllByText("Coming soon").length).toBeGreaterThan(0);
    });

    it("does not render global customer navbar on customer profile pages", () => {
        render(
            <MemoryRouter initialEntries={["/profile/overview?scope=customer"]}>
                <Navbar />
                <Profile section="overview" />
            </MemoryRouter>
        );

        // Global navbar header elements must NOT be present
        expect(screen.queryByRole("link", { name: /return/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /tiffzy home/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /cart/i })).not.toBeInTheDocument();
        expect(screen.queryByTitle(/select language/i)).not.toBeInTheDocument();
    });

    it("renders global customer navbar on /cart with restaurant, profile, and cart, without language selector", () => {
        render(
            <MemoryRouter initialEntries={["/cart"]}>
                <Navbar />
            </MemoryRouter>
        );

        // Logo & name
        expect(screen.getAllByText("Tiffzy").length).toBeGreaterThan(0);
        // Cart link
        expect(screen.getByRole("link", { name: /cart/i })).toBeInTheDocument();
        // Profile link
        expect(screen.getByRole("link", { name: /profile/i })).toBeInTheDocument();
        // No language selector in global customer navbar
        expect(screen.queryByTitle(/select language/i)).not.toBeInTheDocument();
    });

    it("renders language setting inside Settings section and allows language selection", () => {
        render(
            <MemoryRouter initialEntries={["/profile/settings?scope=customer"]}>
                <LanguageProvider>
                    <Profile section="settings" />
                </LanguageProvider>
            </MemoryRouter>
        );

        expect(screen.getAllByText("Language").length).toBeGreaterThan(0);
        expect(screen.getByText("Choose your preferred language")).toBeInTheDocument();
        expect(screen.getByText(/English/i)).toBeInTheDocument();

        const langButton = screen.getByRole("button", { name: /choose your preferred language/i });
        expect(langButton).toBeInTheDocument();

        // Click to open modal
        fireEvent.click(langButton);

        // Modal should open with title
        expect(screen.getByRole("heading", { name: /select language/i })).toBeInTheDocument();
        expect(screen.getByText("Telugu")).toBeInTheDocument();
        expect(screen.getByText("తెలుగు")).toBeInTheDocument();

        // Select Telugu
        fireEvent.click(screen.getByText("Telugu"));

        // Language should be persisted in localStorage
        expect(localStorage.getItem("app_language")).toBe("te");
    });

    it("renders compact Tiffzy brand header linking to customer home '/' on profile overview", () => {
        render(
            <MemoryRouter initialEntries={["/profile/overview?scope=customer"]}>
                <Profile section="overview" />
            </MemoryRouter>
        );

        // Clickable Tiffzy brand link navigating to Customer Home ("/")
        const brandLink = screen.getByRole("link", { name: /^tiffzy$/i });
        expect(brandLink).toBeInTheDocument();
        expect(brandLink).toHaveAttribute("href", "/");

        // Profile identity rendered directly below Tiffzy brand
        expect(screen.getByText("Ramesh Nanda")).toBeInTheDocument();
        expect(screen.getByText("rameshnanda485@gmail.com")).toBeInTheDocument();
    });

    it("renders compact Tiffzy header on subpages (wallet, settings, pay-later) with back navigation and single back button", () => {
        const { unmount } = render(
            <MemoryRouter initialEntries={["/profile/wallet?scope=customer"]}>
                <Profile section="wallet" />
            </MemoryRouter>
        );

        // Clickable Tiffzy brand link navigating to Customer Home ("/")
        const brandLink = screen.getByRole("link", { name: /^tiffzy$/i });
        expect(brandLink).toBeInTheDocument();
        expect(brandLink).toHaveAttribute("href", "/");

        // Section label in header
        expect(screen.getAllByText("Wallet").length).toBeGreaterThan(0);

        // Exactly one back-to-overview navigation button (no duplicate back buttons)
        const backButtons = screen.getAllByRole("link", { name: /back to overview/i });
        expect(backButtons.length).toBe(1);
        expect(backButtons[0]).toHaveAttribute("href", "/profile/overview?scope=customer");

        unmount();

        // Check settings subpage
        render(
            <MemoryRouter initialEntries={["/profile/settings?scope=customer"]}>
                <LanguageProvider>
                    <Profile section="settings" />
                </LanguageProvider>
            </MemoryRouter>
        );

        const settingsBrandLink = screen.getByRole("link", { name: /^tiffzy$/i });
        expect(settingsBrandLink).toHaveAttribute("href", "/");
        expect(screen.getByRole("link", { name: /back to overview/i })).toHaveAttribute("href", "/profile/overview?scope=customer");
    });
});



