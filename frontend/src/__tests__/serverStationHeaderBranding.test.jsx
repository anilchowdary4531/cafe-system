import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Server from "../pages/Server.jsx";
import { LanguageProvider } from "../context/LanguageContext.jsx";
import { RestaurantThemeProvider } from "../context/ThemeContext.jsx";
import { RestaurantContextProvider } from "../context/RestaurantContext.jsx";
import { CartProvider } from "../context/CartContext.jsx";
import { TableStateProvider } from "../context/TableStateContext.jsx";

vi.mock("../hooks/useCachedGet", () => ({
    default: (url) => {
        const urlStr = String(url || "");
        if (urlStr.includes("/tables")) {
            return { data: { tables: [] }, loading: false, refresh: vi.fn() };
        }
        if (urlStr.includes("/menu")) {
            return { data: { items: [] }, loading: false, refresh: vi.fn() };
        }
        if (urlStr.includes("/reservations")) {
            return { data: { reservations: [] }, loading: false, refresh: vi.fn() };
        }
        if (urlStr.includes("/kots")) {
            return { data: { kots: [] }, loading: false, refresh: vi.fn() };
        }
        if (urlStr.includes("/orders")) {
            return { data: { orders: [] }, loading: false, refresh: vi.fn() };
        }
        return { data: null, loading: false, refresh: vi.fn() };
    },
}));

vi.mock("axios", () => {
    const mockAxiosInstance = {
        get: vi.fn().mockResolvedValue({ data: [] }),
        post: vi.fn().mockResolvedValue({ data: { success: true } }),
        put: vi.fn().mockResolvedValue({ data: { success: true } }),
        delete: vi.fn().mockResolvedValue({ data: { success: true } }),
        interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() },
        },
    };
    mockAxiosInstance.create = vi.fn(() => mockAxiosInstance);
    return {
        default: mockAxiosInstance,
        ...mockAxiosInstance,
    };
});

vi.mock("../context/SocketContext.jsx", () => ({
    useSocket: () => ({
        socket: {
            on: vi.fn(),
            off: vi.fn(),
            emit: vi.fn(),
        },
        isConnected: true,
    }),
}));

vi.mock("../context/StaffSocketContext.jsx", () => ({
    useStaffSocket: () => ({
        socket: {
            on: vi.fn(),
            off: vi.fn(),
            emit: vi.fn(),
        },
        isConnected: true,
        lastOnlineTime: new Date(),
    }),
}));

vi.mock("../context/AuthContext.jsx", () => ({
    useAuth: () => ({
        user: { id: 1, name: "Kamalesh Kumar", role: "WAITER", branchId: "BR-01" },
        token: "fake-token",
        logout: vi.fn(),
    }),
}));

const renderWithProviders = (ui) => {
    return render(
        <MemoryRouter initialEntries={["/server"]}>
            <LanguageProvider>
                <RestaurantContextProvider>
                    <RestaurantThemeProvider>
                        <TableStateProvider>
                            <CartProvider>{ui}</CartProvider>
                        </TableStateProvider>
                    </RestaurantThemeProvider>
                </RestaurantContextProvider>
            </LanguageProvider>
        </MemoryRouter>
    );
};

describe("Server Station Header — Owner Panel Branding & Time/Date Layout", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("1. Reuses Owner Panel branding (BrandLogo with theme-brand-logo and theme-brand-text wordmark)", async () => {
        renderWithProviders(<Server />);

        // Logo with Owner Panel theme classes
        const brandLogo = screen.getByAltText("Tiffzy logo");
        expect(brandLogo).toBeInTheDocument();
        expect(brandLogo.className).toContain("theme-brand-logo");

        // Brand wordmark with Owner Panel theme classes
        const wordmark = screen.getByText("Tiffzy");
        expect(wordmark).toBeInTheDocument();
        expect(wordmark.className).toContain("theme-brand-text");

        // Verify old custom emoji box is gone
        expect(screen.queryByText("🍽️")).not.toBeInTheDocument();

        // Verify Server Station badge is still present
        expect(screen.getByText("Server Station")).toBeInTheDocument();
    });

    it("2. Places authoritative time and date strictly ABOVE the staff profile button", async () => {
        renderWithProviders(<Server />);

        const clockContainer = screen.getByTestId("server-station-clock");
        expect(clockContainer).toBeInTheDocument();

        const profileBtn = screen.getByTitle("My Profile");
        expect(profileBtn).toBeInTheDocument();
        expect(profileBtn).toHaveTextContent("Kamalesh");

        // Verify clockContainer appears before profileBtn in the DOM hierarchy
        const parent = clockContainer.parentElement;
        expect(parent).toContainElement(profileBtn);

        // clockContainer is the first child, profile button is the second child
        const children = Array.from(parent.children);
        const clockIndex = children.indexOf(clockContainer);
        const profileIndex = children.indexOf(profileBtn);
        expect(clockIndex).toBeLessThan(profileIndex);

        // Check clock contains time and date
        expect(clockContainer.children.length).toBe(2);
        const timeEl = clockContainer.children[0];
        const dateEl = clockContainer.children[1];

        // TIME is first, DATE is second
        expect(timeEl.className).toContain("tabular-nums");
        expect(dateEl.className).toContain("whitespace-nowrap");
    });

    it("3. Guarantees no duplicate time or date displays exist anywhere in the header", async () => {
        renderWithProviders(<Server />);

        // There should be exactly one clock container in the header
        const clocks = screen.getAllByTestId("server-station-clock");
        expect(clocks).toHaveLength(1);

        // Header should not contain old emoji clock/calendar displays
        expect(screen.queryByText(/🕒/)).not.toBeInTheDocument();
        expect(screen.queryByText(/📅/)).not.toBeInTheDocument();
    });
});
