import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import JekkaRameshProfile from "../pages/JekkaRameshProfile";
import ThamineniAnilKumarProfile from "../pages/ThamineniAnilKumarProfile";
import AboutUs from "../pages/AboutUs";

describe("Leadership & Brand Entity Profiles Audit", () => {
    it("renders Jekka Ramesh profile page with exact name, role, and business", () => {
        render(
            <MemoryRouter>
                <JekkaRameshProfile />
            </MemoryRouter>
        );

        expect(screen.getAllByText("Jekka Ramesh").length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Founder & Developer/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/SURVETRA SERVICES/i).length).toBeGreaterThan(0);
    });

    it("renders Thamineni Anil Kumar profile page with exact name, role, and business", () => {
        render(
            <MemoryRouter>
                <ThamineniAnilKumarProfile />
            </MemoryRouter>
        );

        expect(screen.getAllByText("Thamineni Anil Kumar").length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Proprietor/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/SURVETRA SERVICES/i).length).toBeGreaterThan(0);
    });

    it("renders Leadership section on About Us page with both profiles", () => {
        render(
            <MemoryRouter>
                <AboutUs />
            </MemoryRouter>
        );

        expect(screen.getByText("Our Leadership")).toBeInTheDocument();
        expect(screen.getAllByText("Jekka Ramesh").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Thamineni Anil Kumar").length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Founder & Developer/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Proprietor – SURVETRA SERVICES/i).length).toBeGreaterThan(0);
    });
});
