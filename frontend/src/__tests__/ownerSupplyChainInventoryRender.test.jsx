import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import ErrorBoundary from "../components/ErrorBoundary";
import OwnerSupplyChainInventory from "../pages/admin/OwnerSupplyChainInventory";
import { api } from "../utils/apiClient";

vi.mock("../utils/apiClient", () => ({
    api: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
    },
}));

vi.mock("../utils/toast", () => ({
    showToast: vi.fn(),
}));

describe("OwnerSupplyChainInventory — Runtime Render Regression", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.setItem(
            "user",
            JSON.stringify({ id: 1, role: "OWNER", restaurantId: 1 })
        );
        api.get.mockResolvedValue({ data: { materials: [] } });
    });

    it("renders Inventory Dashboard without triggering ErrorBoundary / Illegal constructor on <History />", async () => {
        render(
            <ErrorBoundary>
                <MemoryRouter initialEntries={["/owner/supply-chain/inventory"]}>
                    <OwnerSupplyChainInventory />
                </MemoryRouter>
            </ErrorBoundary>
        );

        expect(await screen.findByRole("heading", { name: /Inventory Dashboard/i })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: /Recent Stock Movement/i })).toBeInTheDocument();

        await waitFor(() => {
            expect(api.get).toHaveBeenCalledWith("/owner/1/inventory/materials");
            expect(api.get).toHaveBeenCalledWith("/owner/1/inventory/ledger");
        });

        expect(screen.queryByText(/Oops! Connection Lost/i)).toBeNull();
        expect(screen.queryByText(/Illegal constructor/i)).toBeNull();
    });
});
