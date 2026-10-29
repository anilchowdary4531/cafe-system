import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import StaffShell from "../components/StaffShell";
import CashierStation from "../pages/staff/CashierStation";
import CleanerStation from "../pages/staff/CleanerStation";
import StewardStation from "../pages/staff/StewardStation";
import SwiperStation from "../pages/staff/SwiperStation";
import NewOrder from "../pages/admin/NewOrder";
import OfflineStatusBar from "../components/OfflineStatusBar";
import { useConnectivity } from "../hooks/useConnectivity";
import { connectivityService } from "../utils/offline/connectivityService";
import { StaffSocketProvider, useStaffSocket } from "../context/StaffSocketContext";
import { TableStateProvider } from "../context/TableStateContext";
import {
    STAFF_OFFLINE_GRACE_PERIOD_MS,
    writeStaffSession,
    isStaffWithinOfflineGracePeriod,
    isStaffOfflineGracePeriodExpired,
} from "../utils/staffSessionStorage";

// Mock toast and sounds
vi.mock("../utils/toast", () => ({
    showToast: vi.fn(),
}));
vi.mock("../utils/soundPlayer", () => ({
    playNotificationSound: vi.fn(),
    triggerNotificationVibration: vi.fn(),
}));

// Mock axios
vi.mock("axios", () => {
    const mockAxios = {
        get: vi.fn().mockResolvedValue({ data: { success: true, data: [] } }),
        post: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
        put: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
        delete: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
        interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() },
        },
    };
    mockAxios.create = vi.fn().mockReturnValue(mockAxios);
    return { default: mockAxios };
});

// Mock AuthContext
let mockAuthState = {
    user: {
        id: 1,
        name: "Test Staff",
        role: "STAFF",
        designation: "Cleaner",
        restaurantId: 1,
        restaurant: { id: 1, name: "Tiffzy Restaurant" },
    },
    staffToken: "mock-valid-jwt",
    token: "mock-valid-jwt",
    logout: vi.fn(),
};

vi.mock("../context/AuthContext", () => ({
    useAuth: () => mockAuthState,
}));

// Mock socket context state
let mockSocketConnected = true;
let mockSocketInstance = {
    connected: true,
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
};

vi.mock("../context/StaffSocketContext", async () => {
    const actual = await vi.importActual("../context/StaffSocketContext");
    return {
        ...actual,
        useStaffSocket: () => ({
            socket: mockSocketInstance,
            connected: mockSocketConnected,
            isConnected: mockSocketConnected,
            error: "",
        }),
        useOptionalStaffSocket: () => ({
            socket: mockSocketInstance,
            connected: mockSocketConnected,
            isConnected: mockSocketConnected,
            error: "",
        }),
    };
});

// Test component consuming useConnectivity
function ConnectivityMonitor() {
    const { isOnline, isApiReachable, isSocketConnected, isOffline, isLive, isReconnecting, status } = useConnectivity();
    return (
        <div data-testid="connectivity-monitor">
            <span data-testid="status">{status}</span>
            <span data-testid="isOnline">{String(isOnline)}</span>
            <span data-testid="isApiReachable">{String(isApiReachable)}</span>
            <span data-testid="isSocketConnected">{String(isSocketConnected)}</span>
            <span data-testid="isOffline">{String(isOffline)}</span>
            <span data-testid="isLive">{String(isLive)}</span>
            <span data-testid="isReconnecting">{String(isReconnecting)}</span>
        </div>
    );
}

describe("TIFFZY CENTRAL CONNECTIVITY & OFFLINE ARCHITECTURE", () => {
    beforeEach(() => {
        mockSocketConnected = true;
        mockAuthState = {
            user: {
                id: 1,
                name: "Test Staff",
                role: "STAFF",
                designation: "Cleaner",
                restaurantId: 1,
                restaurant: { id: 1, name: "Tiffzy Restaurant" },
            },
            staffToken: "mock-valid-jwt",
            token: "mock-valid-jwt",
            logout: vi.fn(),
        };
        // Reset connectivity service state
        connectivityService.stopPeriodicProbe();
        connectivityService.inFlightProbe = null;
        connectivityService.isOnline = true;
        connectivityService.isReachable = true;
        connectivityService.checked = true;
        connectivityService.consecutiveFailures = 0;
        connectivityService.notify();
    });

    afterEach(() => {
        connectivityService.stopPeriodicProbe();
        vi.clearAllMocks();
        vi.restoreAllMocks();
    });

    // ==========================================
    // TEST 1: Normal production startup does NOT display Offline
    // ==========================================
    it("TEST 1: Normal production startup does NOT display Offline", () => {
        // Fresh service with checked = false (initial startup)
        connectivityService.isOnline = true;
        connectivityService.isReachable = true;
        connectivityService.checked = false;
        connectivityService.notify();

        render(
            <MemoryRouter>
                <ConnectivityMonitor />
            </MemoryRouter>
        );

        expect(screen.getByTestId("isOffline").textContent).toBe("false");
        expect(screen.getByTestId("status").textContent).not.toBe("offline");
    });

    // ==========================================
    // TEST 2: Successful API connectivity displays Live / connected state
    // ==========================================
    it("TEST 2: Successful API connectivity displays Live / connected state", () => {
        connectivityService.recordApiSuccess();

        render(
            <MemoryRouter>
                <StaffShell title="Cleaner Station" designation="Cleaner">
                    <div>Content</div>
                </StaffShell>
            </MemoryRouter>
        );

        expect(screen.getByText("Live")).toBeInTheDocument();
        expect(screen.queryByText("Offline")).not.toBeInTheDocument();
    });

    // ==========================================
    // TEST 3: navigator.onLine === false produces Offline
    // ==========================================
    it("TEST 3: navigator.onLine === false or window offline event produces Offline", async () => {
        render(
            <MemoryRouter>
                <ConnectivityMonitor />
            </MemoryRouter>
        );

        act(() => {
            window.dispatchEvent(new Event("offline"));
        });

        await waitFor(() => {
            expect(screen.getByTestId("isOnline").textContent).toBe("false");
            expect(screen.getByTestId("isOffline").textContent).toBe("true");
            expect(screen.getByTestId("status").textContent).toBe("offline");
        });

        // Window online event restores online
        await act(async () => {
            window.dispatchEvent(new Event("online"));
            connectivityService.recordApiSuccess();
            if (connectivityService.inFlightProbe) {
                await connectivityService.inFlightProbe;
            }
        });

        await waitFor(() => {
            expect(screen.getByTestId("isOnline").textContent).toBe("true");
            expect(screen.getByTestId("isOffline").textContent).toBe("false");
        });
    });

    // ==========================================
    // TEST 4: Temporary API failure does not immediately mark application Offline
    // ==========================================
    it("TEST 4: Temporary API failure does not immediately mark application Offline", async () => {
        // Mock fetch to reject once
        const originalFetch = global.fetch;
        let callCount = 0;
        global.fetch = vi.fn().mockImplementation(() => {
            callCount++;
            return Promise.reject(new Error("Transient network blip"));
        });

        connectivityService.isOnline = true;
        connectivityService.isReachable = true;
        connectivityService.consecutiveFailures = 0;

        render(
            <MemoryRouter>
                <ConnectivityMonitor />
            </MemoryRouter>
        );

        // First single probe failure
        await act(async () => {
            await connectivityService.checkApiReachable();
        });

        // Still reachable because threshold is >= 2 consecutive failures
        expect(connectivityService.consecutiveFailures).toBe(1);
        expect(connectivityService.isReachable).toBe(true);
        expect(screen.getByTestId("isOffline").textContent).toBe("false");

        // Second failure triggers unreachable state
        await act(async () => {
            await connectivityService.checkApiReachable();
        });

        expect(connectivityService.consecutiveFailures).toBe(2);
        expect(connectivityService.isReachable).toBe(false);
        expect(screen.getByTestId("isOffline").textContent).toBe("true");

        global.fetch = originalFetch;
    });

    // ==========================================
    // TEST 5: Temporary Socket.IO disconnect displays reconnecting, NOT Offline
    // ==========================================
    it("TEST 5: Temporary Socket.IO disconnect displays reconnecting, NOT Offline", () => {
        mockSocketConnected = false;
        connectivityService.recordApiSuccess();

        render(
            <MemoryRouter>
                <StaffShell title="Cleaner Station" designation="Cleaner">
                    <div>Content</div>
                </StaffShell>
            </MemoryRouter>
        );

        // When socket is disconnected but network is fine, it says "Reconnecting", NOT "Offline"!
        expect(screen.getByText("Reconnecting")).toBeInTheDocument();
        expect(screen.queryByText("Offline")).not.toBeInTheDocument();
    });

    // ==========================================
    // TEST 6: Socket.IO reconnect restores Live state
    // ==========================================
    it("TEST 6: Socket.IO reconnect restores Live state", () => {
        mockSocketConnected = false;
        connectivityService.recordApiSuccess();

        const { rerender } = render(
            <MemoryRouter>
                <StaffShell title="Cleaner Station" designation="Cleaner">
                    <div>Content</div>
                </StaffShell>
            </MemoryRouter>
        );

        expect(screen.getByText("Reconnecting")).toBeInTheDocument();

        // Socket reconnects
        mockSocketConnected = true;

        rerender(
            <MemoryRouter>
                <StaffShell title="Cleaner Station" designation="Cleaner">
                    <div>Content</div>
                </StaffShell>
            </MemoryRouter>
        );

        expect(screen.getByText("Live")).toBeInTheDocument();
        expect(screen.queryByText("Reconnecting")).not.toBeInTheDocument();
        expect(screen.queryByText("Offline")).not.toBeInTheDocument();
    });

    // ==========================================
    // TEST 7: Token refresh does not produce false Offline badge
    // ==========================================
    it("TEST 7: Token refresh does not produce false Offline badge", () => {
        // Simulate token refresh cycle where token temporarily updates
        mockAuthState = {
            ...mockAuthState,
            staffToken: "newly-refreshed-jwt",
            token: "newly-refreshed-jwt",
        };
        mockSocketConnected = true;
        connectivityService.recordApiSuccess();

        render(
            <MemoryRouter>
                <StaffShell title="Cleaner Station" designation="Cleaner">
                    <div>Station Content</div>
                </StaffShell>
            </MemoryRouter>
        );

        expect(screen.getByText("Live")).toBeInTheDocument();
        expect(screen.queryByText("Offline")).not.toBeInTheDocument();
    });

    // ==========================================
    // TEST 8: 72-hour staff offline grace period is preserved
    // ==========================================
    it("TEST 8: 72-hour staff offline grace period is preserved", () => {
        const now = Date.now();
        localStorage.clear();

        // Active session within 72 hours
        writeStaffSession({
            token: "valid-grace-token",
            refreshToken: "valid-grace-refresh",
            user: { id: 1, role: "STAFF", designation: "Cleaner" },
            scope: "local",
            validatedAt: now - 3600 * 1000 * 12, // 12 hours ago
        });

        expect(isStaffWithinOfflineGracePeriod("local")).toBe(true);
        expect(isStaffOfflineGracePeriodExpired("local")).toBe(false);

        // Beyond 72 hours
        writeStaffSession({
            token: "expired-grace-token",
            refreshToken: "expired-grace-refresh",
            user: { id: 1, role: "STAFF", designation: "Cleaner" },
            scope: "local",
            validatedAt: now - (STAFF_OFFLINE_GRACE_PERIOD_MS + 1000), // > 72 hours
        });

        expect(isStaffWithinOfflineGracePeriod("local")).toBe(false);
        expect(isStaffOfflineGracePeriodExpired("local")).toBe(true);
    });

    // ==========================================
    // TEST 9: Cleaner Station does not falsely display Offline
    // ==========================================
    it("TEST 9: Cleaner Station does not falsely display Offline", () => {
        mockAuthState.user.designation = "Cleaner";
        mockSocketConnected = true;
        connectivityService.recordApiSuccess();

        render(
            <MemoryRouter>
                <TableStateProvider>
                    <CleanerStation />
                </TableStateProvider>
            </MemoryRouter>
        );

        expect(screen.getByText("Live")).toBeInTheDocument();
        expect(screen.queryByText("Offline")).not.toBeInTheDocument();
    });

    // ==========================================
    // TEST 10: Server Station does not falsely display Offline
    // ==========================================
    it("TEST 10: Server Station does not falsely display Offline", () => {
        mockAuthState.user.designation = "Server";
        mockAuthState.user.role = "STAFF";
        mockSocketConnected = true;
        connectivityService.recordApiSuccess();

        render(
            <MemoryRouter>
                <StaffShell title="Server Station" designation="Server">
                    <div>Server Workspace</div>
                </StaffShell>
            </MemoryRouter>
        );

        expect(screen.getByText("Live")).toBeInTheDocument();
        expect(screen.queryByText("Offline")).not.toBeInTheDocument();
    });

    // ==========================================
    // TEST 11: Steward Station does not falsely display Offline
    // ==========================================
    it("TEST 11: Steward Station does not falsely display Offline", () => {
        mockAuthState.user.designation = "Steward";
        mockSocketConnected = true;
        connectivityService.recordApiSuccess();

        render(
            <MemoryRouter>
                <TableStateProvider>
                    <StewardStation />
                </TableStateProvider>
            </MemoryRouter>
        );

        expect(screen.getByText("Live")).toBeInTheDocument();
        expect(screen.queryByText("Offline")).not.toBeInTheDocument();
    });

    // ==========================================
    // TEST 12: Chef Station does not falsely display Offline
    // ==========================================
    it("TEST 12: Chef Station does not falsely display Offline", () => {
        mockAuthState.user.designation = "Chef";
        mockAuthState.user.role = "CHEF";
        mockSocketConnected = true;
        connectivityService.recordApiSuccess();

        render(
            <MemoryRouter>
                <StaffShell title="Kitchen Station" designation="Chef">
                    <div>Chef Workload</div>
                </StaffShell>
            </MemoryRouter>
        );

        expect(screen.getByText("Live")).toBeInTheDocument();
        expect(screen.queryByText("Offline")).not.toBeInTheDocument();
    });

    // ==========================================
    // TEST 13: Cashier Station does not falsely display Offline
    // ==========================================
    it("TEST 13: Cashier Station does not falsely display Offline", () => {
        mockAuthState.user.designation = "Cashier";
        mockSocketConnected = true;
        connectivityService.recordApiSuccess();

        render(
            <MemoryRouter>
                <TableStateProvider>
                    <CashierStation />
                </TableStateProvider>
            </MemoryRouter>
        );

        // Top Shell header
        expect(screen.getByText("Live")).toBeInTheDocument();
        // POS Realtime Status line inside CashierStation
        expect(screen.getByText("ONLINE • REALTIME POS")).toBeInTheDocument();
        expect(screen.queryByText("OFFLINE • SYNC PENDING")).not.toBeInTheDocument();
        expect(screen.queryByText("Offline")).not.toBeInTheDocument();
    });

    // ==========================================
    // TEST 14: Swiper Station does not falsely display Offline
    // ==========================================
    it("TEST 14: Swiper Station does not falsely display Offline", () => {
        mockAuthState.user.designation = "Swiper";
        mockSocketConnected = true;
        connectivityService.recordApiSuccess();

        render(
            <MemoryRouter>
                <TableStateProvider>
                    <SwiperStation />
                </TableStateProvider>
            </MemoryRouter>
        );

        expect(screen.getByText("Live")).toBeInTheDocument();
        expect(screen.queryByText("Offline")).not.toBeInTheDocument();
    });

    // ==========================================
    // TEST 15: Owner/Manager pages do not falsely display Offline
    // ==========================================
    it("TEST 15: Owner/Manager pages do not falsely display Offline", () => {
        mockAuthState.user.role = "OWNER";
        mockSocketConnected = true;
        connectivityService.recordApiSuccess();

        render(
            <MemoryRouter>
                <OfflineStatusBar />
            </MemoryRouter>
        );

        // OfflineStatusBar renders green ONLINE pill when connected
        expect(screen.getByText("ONLINE")).toBeInTheDocument();
        expect(screen.queryByText(/OFFLINE MODE/i)).not.toBeInTheDocument();
    });
});
