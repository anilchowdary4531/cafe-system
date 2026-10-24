import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import axios from "axios";
import StewardStation from "../pages/staff/StewardStation";
import { StaffSocketProvider, useStaffSocket } from "../context/StaffSocketContext";
import StaffShell from "../components/StaffShell";

// Mock axios
vi.mock("axios");

// Mock toast and sound
vi.mock("../utils/toast", () => ({
    showToast: vi.fn(),
}));
vi.mock("../utils/soundPlayer", () => ({
    playNotificationSound: vi.fn(),
    triggerNotificationVibration: vi.fn(),
}));

// Mock AuthContext
const mockUser = {
    id: 101,
    name: "John Steward",
    role: "WAITER",
    designation: "STEWARD",
    restaurantId: 1,
    restaurant: { id: 1, name: "Tiffzy Grand" },
};

let mockAuthState = {
    user: mockUser,
    staffToken: "test-steward-token",
    token: "test-steward-token",
};

vi.mock("../context/AuthContext", () => ({
    useAuth: () => mockAuthState,
}));

// Realtime socket event bus simulation
class MockSocket {
    constructor() {
        this.listeners = new Map();
        this.connected = true;
        this.io = {
            listeners: new Map(),
            on: (event, cb) => {
                if (!this.io.listeners.has(event)) this.io.listeners.set(event, []);
                this.io.listeners.get(event).push(cb);
            },
            off: (event, cb) => {
                const list = this.io.listeners.get(event) || [];
                this.io.listeners.set(event, list.filter((fn) => fn !== cb));
            },
            emit: (event, ...args) => {
                const list = this.io.listeners.get(event) || [];
                list.forEach((fn) => fn(...args));
            },
        };
    }

    on(event, cb) {
        if (!this.listeners.has(event)) this.listeners.set(event, []);
        this.listeners.get(event).push(cb);
    }

    off(event, cb) {
        const list = this.listeners.get(event) || [];
        this.listeners.set(event, list.filter((fn) => fn !== cb));
    }

    emit(event, ...args) {
        const list = this.listeners.get(event) || [];
        list.forEach((fn) => fn(...args));
    }

    disconnect() {
        this.connected = false;
        this.emit("disconnect", "transport close");
    }
}

let mockSocketInstance;
let mockSocketState;

vi.mock("../context/StaffSocketContext", async () => {
    return {
        useStaffSocket: () => mockSocketState,
        StaffSocketProvider: ({ children }) => <div>{children}</div>,
    };
});

describe("TIFFZY STEWARD WORKSPACE — THEME, DENSITY & REALTIME WORKFLOW SUITE", () => {
    const mockTasks = [
        {
            id: 201,
            title: "Bring extra water glasses",
            description: "Table 4 requested 2 bottles of sparkling water",
            category: "WATER",
            status: "PENDING",
            restaurantId: 1,
            table: { id: 4, tableNo: "4" },
            requestedByUser: { id: 50, name: "Server Alice" },
        },
        {
            id: 202,
            title: "Cutlery replenishment",
            description: "Table 7 needs fresh forks and spoons",
            category: "CUTLERY",
            status: "ACCEPTED",
            assignedTo: 101, // assigned to John Steward
            restaurantId: 1,
            table: { id: 7, tableNo: "7" },
        },
        {
            id: 203,
            title: "Clear completed plates",
            category: "CLEARING",
            status: "COMPLETED",
            assignedTo: 101,
            restaurantId: 1,
            table: { id: 2, tableNo: "2" },
            completedAt: new Date().toISOString(),
        },
    ];

    const mockFoodRunnerItems = [
        {
            id: 301,
            kotId: 501,
            itemId: 301,
            itemName: "Paneer Butter Masala",
            qty: 2,
            notes: "Extra spicy, less oil",
            status: "READY",
            kot: {
                id: 501,
                kotNo: 12,
                orderId: 901,
                tableNo: "5",
            },
        },
        {
            id: 302,
            kotId: 502,
            itemId: 302,
            itemName: "Butter Naan",
            qty: 4,
            status: "READY",
            kot: {
                id: 502,
                kotNo: 13,
                orderId: 902,
                tableNo: "8",
            },
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        mockSocketInstance = new MockSocket();
        mockSocketState = {
            socket: mockSocketInstance,
            connected: true,
            isConnected: true,
            connectionStatus: "connected",
            status: "connected",
            isConnecting: false,
            isReconnecting: false,
            error: "",
        };

        axios.get.mockImplementation((url) => {
            if (url.includes("/api/v1/staff/tasks")) {
                return Promise.resolve({ data: { success: true, tasks: mockTasks } });
            }
            if (url.includes("/api/v1/staff/food-runner-items")) {
                return Promise.resolve({ data: { success: true, items: mockFoodRunnerItems } });
            }
            return Promise.resolve({ data: { success: true } });
        });

        axios.put.mockResolvedValue({ data: { success: true } });
    });

    // 1. Theme and visual consistency test
    it("A. Steward renders with Tiffzy theme tokens without pitch-black background", async () => {
        const { container } = render(
            <BrowserRouter>
                <StewardStation />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Steward Station — Floor Service & Food Runner")).toBeInTheDocument();
        });

        // Verify root uses Tiffzy adaptive slate theme, not hardcoded pitch-black bg-neutral-950
        const root = container.querySelector(".min-h-screen");
        expect(root).toBeInTheDocument();
        expect(root.className).toContain("bg-slate-50/60");
        expect(root.className).not.toContain("bg-neutral-950");

        // Verify top header uses white/slate theme
        const header = container.querySelector("header");
        expect(header.className).toContain("bg-white/95");
        expect(header.className).not.toContain("bg-neutral-900/95");
    });

    // 2. Compact empty state & density test
    it("B. Steward does not show excessive empty vertical height when empty", async () => {
        axios.get.mockImplementation((url) => {
            if (url.includes("/api/v1/staff/tasks")) {
                return Promise.resolve({ data: { success: true, tasks: [] } });
            }
            if (url.includes("/api/v1/staff/food-runner-items")) {
                return Promise.resolve({ data: { success: true, items: [] } });
            }
            return Promise.resolve({ data: { success: true } });
        });

        const { container } = render(
            <BrowserRouter>
                <StewardStation />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("No Food Waiting")).toBeInTheDocument();
        });

        // Compact empty state should not have oversized p-12 padding
        const emptyState = screen.getByText("No Food Waiting").closest("div");
        expect(emptyState.className).toContain("py-7");
        expect(emptyState.className).not.toContain("p-12");
        expect(emptyState.className).toContain("border-dashed");
    });

    // 3. Responsive layout & header controls
    it("C. Steward header maintains compact layout and touch-accessible buttons", async () => {
        render(
            <BrowserRouter>
                <StewardStation />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Tiffzy Grand")).toBeInTheDocument();
        });

        const refreshBtn = screen.getByRole("button", { name: /refresh steward workstation data/i });
        expect(refreshBtn).toBeInTheDocument();
        expect(refreshBtn.className).toContain("min-h-[40px]");
        expect(refreshBtn.className).toContain("min-w-[40px]");
    });

    // 4. Food runner navigation & dish cards
    it("D. Food Runner queue displays ready dishes with canonical table & KOT identity", async () => {
        render(
            <BrowserRouter>
                <StewardStation />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("2x Paneer Butter Masala")).toBeInTheDocument();
            expect(screen.getByText("Table 5")).toBeInTheDocument();
            expect(screen.getByText("KOT #12")).toBeInTheDocument();
            expect(screen.getByText(/Note: Extra spicy, less oil/i)).toBeInTheDocument();
        });

        const deliverBtn = screen.getByRole("button", { name: /Deliver to Table 5/i });
        expect(deliverBtn).toBeInTheDocument();

        await act(async () => {
            fireEvent.click(deliverBtn);
        });
        expect(axios.put).toHaveBeenCalledWith(
            expect.stringContaining("/api/v1/staff/food-runner-items/301/delivered"),
            {},
            expect.anything()
        );
    });

    // 5. Service Queue navigation & task acceptance
    it("E. Service Queue displays pending table assistance requests with accept action", async () => {
        render(
            <BrowserRouter>
                <StewardStation />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Pending Requests")).toBeInTheDocument();
        });

        // Click Service Queue tab
        const queueTab = screen.getByTestId("staff-tab-TASKS");
        await act(async () => {
            fireEvent.click(queueTab);
        });

        await waitFor(() => {
            expect(screen.getByText("Bring extra water glasses")).toBeInTheDocument();
            expect(screen.getByText("Table 4")).toBeInTheDocument();
            expect(screen.getByText(/Requested by: Server Alice/i)).toBeInTheDocument();
        });

        const acceptBtn = screen.getByRole("button", { name: /Accept Task/i });
        await act(async () => {
            fireEvent.click(acceptBtn);
        });

        expect(axios.put).toHaveBeenCalledWith(
            expect.stringContaining("/api/v1/staff/tasks/201/accept"),
            {},
            expect.anything()
        );
    });

    // 6. My Active Tasks lifecycle
    it("F. My Active tab tracks in-progress tasks with start and complete actions", async () => {
        render(
            <BrowserRouter>
                <StewardStation />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("My In-Progress")).toBeInTheDocument();
        });

        const myWorkTab = screen.getByTestId("staff-tab-MY_WORK");
        await act(async () => {
            fireEvent.click(myWorkTab);
        });

        await waitFor(() => {
            expect(screen.getByText("Cutlery replenishment")).toBeInTheDocument();
            expect(screen.getByText("Table 7")).toBeInTheDocument();
            expect(screen.getByText("ACCEPTED")).toBeInTheDocument();
        });

        const startBtn = screen.getByRole("button", { name: /Start Working/i });
        await act(async () => {
            fireEvent.click(startBtn);
        });

        expect(axios.put).toHaveBeenCalledWith(
            expect.stringContaining("/api/v1/staff/tasks/202/start"),
            {},
            expect.anything()
        );

        const completeBtn = screen.getByRole("button", { name: /Mark Completed/i });
        await act(async () => {
            fireEvent.click(completeBtn);
        });

        expect(axios.put).toHaveBeenCalledWith(
            expect.stringContaining("/api/v1/staff/tasks/202/finish"),
            {},
            expect.anything()
        );
    });

    // 7. Completed tasks log
    it("G. Completed tab shows finished services for today", async () => {
        render(
            <BrowserRouter>
                <StewardStation />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Done Today")).toBeInTheDocument();
        });

        const completedTab = screen.getByTestId("staff-tab-COMPLETED");
        await act(async () => {
            fireEvent.click(completedTab);
        });

        await waitFor(() => {
            expect(screen.getByText("Clear completed plates")).toBeInTheDocument();
            expect(screen.getByText("Done")).toBeInTheDocument();
        });
    });

    // 8. Realtime Socket Status: Online/Live
    it("H & I. Displays Live / Online status when Socket.IO is connected", async () => {
        render(
            <BrowserRouter>
                <StewardStation />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Live")).toBeInTheDocument();
        });
        expect(screen.queryByText("Offline")).not.toBeInTheDocument();
    });

    // 9. Realtime Socket Status: Offline when disconnected
    it("J. Displays Offline when Socket.IO is disconnected", async () => {
        mockSocketState = {
            socket: mockSocketInstance,
            connected: false,
            isConnected: false,
            connectionStatus: "disconnected",
            status: "disconnected",
            isConnecting: false,
            isReconnecting: false,
            error: "",
        };

        render(
            <BrowserRouter>
                <StewardStation />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Offline")).toBeInTheDocument();
        });
        expect(screen.queryByText("Live")).not.toBeInTheDocument();
    });

    // 10. Realtime Socket Status: Reconnecting state
    it("K. Displays Reconnecting... when socket is attempting reconnection", async () => {
        mockSocketState = {
            socket: mockSocketInstance,
            connected: false,
            isConnected: false,
            connectionStatus: "reconnecting",
            status: "reconnecting",
            isConnecting: false,
            isReconnecting: true,
            error: "",
        };

        render(
            <BrowserRouter>
                <StewardStation />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Reconnecting...")).toBeInTheDocument();
        });
    });

    // 11. Socket listener cleanup on unmount
    it("L. Cleans up all socket listeners upon unmount to prevent leaks", async () => {
        const offSpy = vi.spyOn(mockSocketInstance, "off");

        const { unmount } = render(
            <BrowserRouter>
                <StewardStation />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("Steward Station — Floor Service & Food Runner")).toBeInTheDocument();
        });

        unmount();

        expect(offSpy).toHaveBeenCalledWith("kitchen:item_ready", expect.any(Function));
        expect(offSpy).toHaveBeenCalledWith("food:delivered", expect.any(Function));
        expect(offSpy).toHaveBeenCalledWith("steward:assistance_requested", expect.any(Function));
        expect(offSpy).toHaveBeenCalledWith("steward:task_created", expect.any(Function));
        expect(offSpy).toHaveBeenCalledWith("task:assigned", expect.any(Function));
        expect(offSpy).toHaveBeenCalledWith("task:updated", expect.any(Function));
        expect(offSpy).toHaveBeenCalledWith("task:completed", expect.any(Function));
    });

    // 12. kitchen:item_ready event triggers refresh
    it("M. kitchen:item_ready event reloads food runner items in realtime", async () => {
        render(
            <BrowserRouter>
                <StewardStation />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("2x Paneer Butter Masala")).toBeInTheDocument();
        });

        const initialCalls = axios.get.mock.calls.length;

        // Simulate realtime food ready event from kitchen KDS
        await act(async () => {
            mockSocketInstance.emit("kitchen:item_ready", { itemId: 303, status: "READY" });
        });

        await waitFor(() => {
            expect(axios.get.mock.calls.length).toBeGreaterThan(initialCalls);
        });
    });

    // 13. food:delivered event triggers refresh
    it("N. food:delivered event reloads food runner items in realtime", async () => {
        render(
            <BrowserRouter>
                <StewardStation />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("2x Paneer Butter Masala")).toBeInTheDocument();
        });

        const initialCalls = axios.get.mock.calls.length;

        // Simulate realtime food delivered event
        await act(async () => {
            mockSocketInstance.emit("food:delivered", { itemId: 301, tableNo: "5" });
        });

        await waitFor(() => {
            expect(axios.get.mock.calls.length).toBeGreaterThan(initialCalls);
        });
    });

    // 14. Canonical OrderItem identity verification
    it("P. Preserves backend-authoritative OrderItem and KOT identity", async () => {
        render(
            <BrowserRouter>
                <StewardStation />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("4x Butter Naan")).toBeInTheDocument();
        });

        const deliverNaanBtn = screen.getByRole("button", { name: /Deliver to Table 8/i });
        await act(async () => {
            fireEvent.click(deliverNaanBtn);
        });

        // Verification: uses canonical item ID 302
        expect(axios.put).toHaveBeenCalledWith(
            expect.stringContaining("/api/v1/staff/food-runner-items/302/delivered"),
            {},
            expect.anything()
        );
    });
});
