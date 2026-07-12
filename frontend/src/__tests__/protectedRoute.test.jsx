import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
    user: null,
    staffToken: null,
}));

vi.mock("../context/AuthContext", () => ({
    default: ({ children }) => <>{children}</>,
    useAuth: () => authState,
}));

vi.mock("../context/StaffSocketContext.jsx", () => ({
    StaffSocketProvider: ({ children }) => <>{children}</>,
}));

import ProtectedRoute from "../routes/ProtectedRoute";

const LocationSpy = () => {
    const location = useLocation();
    return (
        <div data-testid="location">
            {location.pathname}
            {location.search}
        </div>
    );
};

const renderProtectedRoute = ({ path = "/secure", role, roles, user, staffToken } = {}) => {
    authState.user = user ?? null;
    authState.staffToken = staffToken ?? null;

    render(
        <MemoryRouter initialEntries={[path]}>
            <LocationSpy />
            <Routes>
                <Route
                    path="/secure"
                    element={
                        <ProtectedRoute role={role} roles={roles}>
                            <div data-testid="secure-content">Secure content</div>
                        </ProtectedRoute>
                    }
                />
                <Route path="/login" element={<div data-testid="login-page">Login</div>} />
                <Route path="/" element={<div data-testid="home-page">Home</div>} />
            </Routes>
        </MemoryRouter>
    );
};

describe("ProtectedRoute", () => {
    it("sends anonymous users to staff login", () => {
        renderProtectedRoute();

        expect(screen.getByTestId("login-page")).toBeInTheDocument();
        expect(screen.getByTestId("location")).toHaveTextContent("/login?mode=staff");
    });

    it("renders children when the staff role is allowed", () => {
        renderProtectedRoute({
            roles: ["OWNER", "CHEF"],
            user: { role: "chef" },
            staffToken: "token-123",
        });

        expect(screen.getByTestId("secure-content")).toBeInTheDocument();
        expect(screen.getByTestId("location")).toHaveTextContent("/secure");
    });

    it("redirects staff with the wrong role to the home page", () => {
        renderProtectedRoute({
            roles: ["OWNER"],
            user: { role: "CHEF" },
            staffToken: "token-123",
        });

        expect(screen.getByTestId("home-page")).toBeInTheDocument();
        expect(screen.getByTestId("location")).toHaveTextContent("/");
    });
});
