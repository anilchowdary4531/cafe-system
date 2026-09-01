import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import SuperAdminCreateRestaurant from "../pages/super-admin/SuperAdminCreateRestaurant";
import { api } from "../utils/apiClient";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({
        logout: vi.fn(),
        user: { role: "SUPER_ADMIN", name: "Super Admin", email: "admin@tiffzy.com" },
    }),
}));

vi.mock("../utils/apiClient", async () => {
    const actual = await vi.importActual("../utils/apiClient");
    return {
        ...actual,
        api: {
            get: vi.fn(),
            post: vi.fn(),
        },
    };
});

describe("SuperAdminCreateRestaurant Page Audit", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders all required form inputs and submit button", () => {
        render(
            <MemoryRouter>
                <SuperAdminCreateRestaurant />
            </MemoryRouter>
        );

        expect(screen.getByLabelText(/Restaurant Name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Slug/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Owner Name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Owner Email/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Owner Password/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Create Restaurant & Owner/i })).toBeInTheDocument();
    });

    it("auto-populates slug from restaurant name and allows hyphenated manual slug input", () => {
        render(
            <MemoryRouter>
                <SuperAdminCreateRestaurant />
            </MemoryRouter>
        );

        const nameInput = screen.getByLabelText(/Restaurant Name/i);
        const slugInput = screen.getByLabelText(/Slug/i);

        fireEvent.change(nameInput, { target: { value: "Chai & Snacks Bar" } });
        expect(slugInput.value).toBe("chai-snacks-bar");

        fireEvent.change(slugInput, { target: { value: "custom-chai-bar" } });
        expect(slugInput.value).toBe("custom-chai-bar");
    });

    it("submits the form successfully, displays success alert, and resets form", async () => {
        api.post.mockResolvedValue({
            data: {
                message: "Restaurant and owner created",
                restaurant: { id: 10, name: "Tasty Bites", slug: "tasty-bites" },
            },
        });

        render(
            <MemoryRouter>
                <SuperAdminCreateRestaurant />
            </MemoryRouter>
        );

        fireEvent.change(screen.getByLabelText(/Restaurant Name/i), { target: { value: "Tasty Bites" } });
        fireEvent.change(screen.getByLabelText(/Owner Name/i), { target: { value: "John Doe" } });
        fireEvent.change(screen.getByLabelText(/Owner Email/i), { target: { value: "owner@tastybites.com" } });
        fireEvent.change(screen.getByLabelText(/Owner Password/i), { target: { value: "password123" } });

        const submitBtn = screen.getByRole("button", { name: /Create Restaurant & Owner/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith(
                "/super-admin/restaurants",
                expect.objectContaining({
                    name: "Tasty Bites",
                    slug: "tasty-bites",
                    ownerName: "John Doe",
                    ownerEmail: "owner@tastybites.com",
                    ownerPassword: "password123",
                })
            );
            expect(screen.getByText("Restaurant and owner created successfully.")).toBeInTheDocument();
        });

        expect(screen.getByLabelText(/Restaurant Name/i).value).toBe("");
    });

    it("displays error message on submission failure", async () => {
        api.post.mockRejectedValue({
            response: { data: { message: "Restaurant slug already exists" } },
        });

        render(
            <MemoryRouter>
                <SuperAdminCreateRestaurant />
            </MemoryRouter>
        );

        fireEvent.change(screen.getByLabelText(/Restaurant Name/i), { target: { value: "Existing Cafe" } });
        fireEvent.change(screen.getByLabelText(/Owner Name/i), { target: { value: "Jane Doe" } });
        fireEvent.change(screen.getByLabelText(/Owner Email/i), { target: { value: "jane@existing.com" } });
        fireEvent.change(screen.getByLabelText(/Owner Password/i), { target: { value: "securepass" } });

        fireEvent.click(screen.getByRole("button", { name: /Create Restaurant & Owner/i }));

        await waitFor(() => {
            expect(screen.getByText("Restaurant slug already exists")).toBeInTheDocument();
        });
    });
});
