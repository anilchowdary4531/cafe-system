import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";

import StaffShell from "../components/StaffShell";
import StewardStation from "../pages/staff/StewardStation";
import Server from "../pages/Server";
import CashierStation from "../pages/staff/CashierStation";
import SwiperStation from "../pages/staff/SwiperStation";
import CustomWorkspace from "../pages/staff/CustomWorkspace";
import { TableStateProvider } from "../context/TableStateContext";
import { LanguageProvider } from "../context/LanguageContext";
import { RestaurantThemeProvider } from "../context/ThemeContext";
import { RestaurantContextProvider } from "../context/RestaurantContext";
import { CartProvider } from "../context/CartContext";

// Mock useCachedGet
vi.mock("../hooks/useCachedGet", () => ({
    default: (url) => {
        const urlStr = String(url || "");
        if (urlStr.includes("/tables")) {
            return {
                data: {
                    tables: [
                        { id: 1, tableNo: "1", section: "Main Floor", seats: 4, status: "AVAILABLE" },
                        { id: 2, tableNo: "2", section: "Terrace", seats: 2, status: "OCCUPIED" },
                    ],
                },
                loading: false,
                refresh: vi.fn(),
            };
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

// Mock axios
vi.mock("axios", () => {
    const mockAxiosInstance = {
        get: vi.fn().mockResolvedValue({ data: { success: true, tasks: [], tables: [], orders: [] } }),
        post: vi.fn().mockResolvedValue({ data: { success: true } }),
        put: vi.fn().mockResolvedValue({ data: { success: true } }),
        patch: vi.fn().mockResolvedValue({ data: { success: true } }),
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

// Mock toast and sound
vi.mock("../utils/toast", () => ({
    showToast: vi.fn(),
}));
vi.mock("../utils/soundPlayer", () => ({
    playNotificationSound: vi.fn().mockResolvedValue(true),
    triggerNotificationVibration: vi.fn(),
}));

let mockUser = {
    id: 10,
    name: "Alex Staff",
    role: "STAFF",
    designation: "Steward",
    restaurantId: 1,
    restaurant: { id: 1, name: "Tiffzy Grand" },
    access: { tables: true, billing: true, kitchen: true, reports: true },
};

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({
        user: mockUser,
        staffToken: "mock-jwt-token",
        token: "mock-jwt-token",
        logout: vi.fn(),
    }),
}));

const mockSocket = {
    connected: true,
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
};

vi.mock("../context/SocketContext", () => ({
    useSocket: () => ({
        socket: mockSocket,
        isConnected: true,
    }),
}));

vi.mock("../context/StaffSocketContext", () => ({
    useStaffSocket: () => ({
        socket: mockSocket,
        isConnected: true,
    }),
}));

const renderWithProviders = (ui, initialEntry = "/") => {
    return render(
        <MemoryRouter initialEntries={[initialEntry]}>
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

describe("Comprehensive Staff Stations Responsive Design Matrix", () => {
    const viewports = [
        { name: "Small Mobile Phone", width: 320, height: 568 },
        { name: "Standard Mobile Phone", width: 375, height: 667 },
        { name: "Large Mobile Phone", width: 390, height: 844 },
        { name: "Large Mobile Plus", width: 414, height: 896 },
        { name: "Tablet Portrait (iPad Mini/Air)", width: 768, height: 1024 },
        { name: "Tablet Portrait (iPad 10th Gen)", width: 820, height: 1180 },
        { name: "Tablet Landscape / Small Laptop", width: 1024, height: 768 },
        { name: "Standard Laptop", width: 1280, height: 800 },
        { name: "Desktop Monitor", width: 1440, height: 900 },
        { name: "Ultra-Wide / Full HD Monitor", width: 1920, height: 1080 },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        localStorage.setItem("token", "mock-jwt-token");
        localStorage.setItem("staffToken", "mock-jwt-token");
        localStorage.setItem("restaurantId", "1");

        axios.get.mockImplementation((url) => {
            if (url.includes("/orders/live")) {
                return Promise.resolve({
                    data: {
                        orders: [
                            {
                                id: 101,
                                orderNo: "101",
                                tableNo: "T1",
                                status: "ACTIVE",
                                paymentStatus: "PENDING",
                                total: 350,
                                items: [{ name: "Dosa", quantity: 1, price: 100 }],
                            },
                        ],
                    },
                });
            }
            return Promise.resolve({ data: { success: true, tasks: [], tables: [], orders: [] } });
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("StaffShell responsive navigation architecture", () => {
        it("renders desktop navbar with hidden lg:flex and sub-bar with lg:hidden", () => {
            const { container } = render(
                <MemoryRouter>
                    <StaffShell
                        title="Station Test"
                        tabs={[
                            { id: "tab1", label: "Overview" },
                            { id: "tab2", label: "History" },
                        ]}
                        activeTab="tab1"
                        onTabChange={() => {}}
                    >
                        <div>Content</div>
                    </StaffShell>
                </MemoryRouter>
            );

            // Desktop tabs must have hidden lg:flex
            const desktopNav = container.querySelector("nav.hidden.lg\\:flex");
            expect(desktopNav).toBeInTheDocument();

            // Mobile/Tablet secondary sub-bar must have lg:hidden
            const mobileSubBar = container.querySelector(".lg\\:hidden.border-b");
            expect(mobileSubBar).toBeInTheDocument();

            // Mobile tab items must have min-h-[40px] touch target
            const mobileTabButtons = mobileSubBar.querySelectorAll("button");
            expect(mobileTabButtons.length).toBe(2);
            mobileTabButtons.forEach((btn) => {
                expect(btn.className).toContain("min-h-[40px]");
            });

            // Outer wrapper must have overflow-x-hidden
            const rootWrapper = container.firstChild;
            expect(rootWrapper.className).toContain("overflow-x-hidden");
        });
    });

    describe("Steward Station Responsive Verification", () => {
        viewports.forEach(({ name, width, height }) => {
            it(`renders gracefully without layout errors on ${name} (${width}×${height})`, async () => {
                window.innerWidth = width;
                window.innerHeight = height;
                window.dispatchEvent(new Event("resize"));

                const { container } = renderWithProviders(<StewardStation />);

                await waitFor(() => {
                    expect(screen.getByText(/Steward Station — Floor Service & Food Runner/i)).toBeInTheDocument();
                });

                // Assert main container constraints
                const mainWrapper = container.querySelector("main .max-w-7xl");
                expect(mainWrapper).toBeInTheDocument();
                expect(mainWrapper.className).toContain("min-w-0");

                // Assert responsive KPI grid
                const kpiGrid = container.querySelector(".grid.grid-cols-1");
                expect(kpiGrid).toBeInTheDocument();
                expect(kpiGrid.className).toContain("min-[360px]:grid-cols-2");
                expect(kpiGrid.className).toContain("lg:grid-cols-4");

                // Assert touch targets >= 40px
                const kpiCards = kpiGrid.querySelectorAll("[role='button']");
                expect(kpiCards.length).toBe(4);
                kpiCards.forEach((c) => {
                    expect(c.className).toContain("min-h-[80px]");
                });
            });
        });
    });

    describe("Server Station Responsive Verification", () => {
        it("adapts meal shifts and navigation bar across responsive switch point (1024px)", async () => {
            mockUser.designation = "Server";
            const { container } = renderWithProviders(<Server />, "/server");

            await waitFor(() => {
                expect(screen.getByText("Server Station")).toBeInTheDocument();
            });

            // Desktop meal shifts must be hidden lg:flex
            const desktopShifts = container.querySelector(".hidden.lg\\:flex");
            expect(desktopShifts).toBeInTheDocument();

            // Mobile/tablet sub-bar must be lg:hidden
            const mobileSubBar = container.querySelector(".lg\\:hidden.border-b");
            expect(mobileSubBar).toBeInTheDocument();

            // Server action buttons in header must meet touch target sizes
            const settingsBtn = container.querySelector("button[title='Settings']");
            expect(settingsBtn).toBeInTheDocument();
            expect(settingsBtn.className).toContain("min-h-[36px]");
        });
    });

    describe("Cashier Station Responsive Verification", () => {
        it("verifies container bounds and shift metrics responsive grid", async () => {
            mockUser.designation = "Cashier";
            const { container } = renderWithProviders(<CashierStation />, "/staff/cashier");

            await waitFor(() => {
                expect(screen.getByText(/Cashier Station POS Workstation/i)).toBeInTheDocument();
            });

            // Terminal container must have max-w-7xl and min-w-0
            const maxWContainer = container.querySelector("main .max-w-7xl");
            expect(maxWContainer).toBeInTheDocument();
            expect(maxWContainer.className).toContain("min-w-0");
        });
    });

    describe("Swiper Station Responsive Verification", () => {
        it("verifies container bounds, responsive grid, and touch buttons", async () => {
            mockUser.designation = "Swiper";
            const { container } = renderWithProviders(<SwiperStation />, "/staff/swiper");

            await waitFor(() => {
                expect(screen.getByText(/Tables Awaiting Settlement/i)).toBeInTheDocument();
            });

            const mainContainer = container.querySelector("main .max-w-7xl");
            expect(mainContainer).toBeInTheDocument();
            expect(mainContainer.className).toContain("min-w-0");

            // Check responsive grid
            const grid = container.querySelector(".grid.grid-cols-1");
            expect(grid).toBeInTheDocument();
            expect(grid.className).toContain("min-[360px]:grid-cols-2");
        });
    });

    describe("Custom Workspace Responsive Verification", () => {
        it("verifies container bounds, responsive module cards grid, and min touch heights", async () => {
            mockUser.designation = "CustomStaff";
            const { container } = renderWithProviders(<CustomWorkspace />, "/staff/workspace");

            await waitFor(() => {
                expect(screen.getByText("Custom Staff Workspace")).toBeInTheDocument();
            });

            const mainContainer = container.querySelector("main .max-w-7xl");
            expect(mainContainer).toBeInTheDocument();
            expect(mainContainer.className).toContain("min-w-0");

            // Modules grid must have min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4
            const modulesGrid = container.querySelector(".grid.grid-cols-1");
            expect(modulesGrid).toBeInTheDocument();
            expect(modulesGrid.className).toContain("min-[480px]:grid-cols-2");
            expect(modulesGrid.className).toContain("lg:grid-cols-3");

            // Module links must have min-h-[110px]
            const moduleLinks = modulesGrid.querySelectorAll("a");
            expect(moduleLinks.length).toBeGreaterThan(0);
            moduleLinks.forEach((link) => {
                expect(link.className).toContain("min-h-[110px]");
            });
        });
    });
});
