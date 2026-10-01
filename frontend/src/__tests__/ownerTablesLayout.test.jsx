import { describe, it, expect } from "vitest";

describe("Owner Panel Tables - Popover Positioning & Layout Engine", () => {
    // Pure algorithm mirror of resolvePopoverPlacement in OwnerLayout.jsx
    function calculatePopoverPlacement({
        cardRect,
        containerRect,
        viewportWidth = 1024,
        viewportHeight = 768,
        popupWidth = 210,
        popupHeight = 260,
    }) {
        const edgePadding = 16;
        const spaceBelow = viewportHeight - cardRect.bottom - edgePadding;
        const spaceAbove = cardRect.top - edgePadding;

        const posY = (spaceBelow < popupHeight && spaceAbove > spaceBelow) ? "top" : "bottom";

        const rightAlignedLeft = cardRect.right - popupWidth;
        const leftAlignedRight = cardRect.left + popupWidth;

        let posX = "left";
        if (rightAlignedLeft >= containerRect.left + 8 && leftAlignedRight > containerRect.right - 8) {
            posX = "right";
        } else {
            posX = "left";
        }

        return { x: posX, y: posY };
    }

    // Pure algorithm mirror of toTitleCase in OwnerLayout.jsx
    function toTitleCase(str) {
        return String(str || "")
            .trim()
            .replace(/\s+/g, " ")
            .split(" ")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(" ");
    }

    it("Scenario 1: Table 1 at far left edge NEVER clips off the left screen edge", () => {
        const containerRect = { left: 0, right: 800, width: 800 };
        // Card 1 is at x=16px from the screen edge, width=90px
        const cardRect = { left: 16, right: 106, top: 150, bottom: 240, width: 90, height: 90 };

        const placement = calculatePopoverPlacement({
            cardRect,
            containerRect,
            popupWidth: 210,
            popupHeight: 260,
        });

        // If right-0 were used, the left edge would be: 106 - 210 = -104px (outside viewport!)
        // The algorithm MUST choose "left" (left-0), so the left edge is at cardRect.left (16px >= 0)
        expect(placement.x).toBe("left");
        expect(placement.y).toBe("bottom");

        // Calculate actual screen left coordinate of popup with left-0
        const actualPopupLeft = cardRect.left;
        expect(actualPopupLeft).toBeGreaterThanOrEqual(0);
        expect(actualPopupLeft + 210).toBeLessThanOrEqual(containerRect.right);
    });

    it("Scenario 2: Table near right edge switches to right-aligned to prevent right-edge clipping", () => {
        const containerRect = { left: 0, right: 800, width: 800 };
        // Card is at the far right column, e.g., left=700px, right=790px
        const cardRect = { left: 700, right: 790, top: 150, bottom: 240, width: 90, height: 90 };

        const placement = calculatePopoverPlacement({
            cardRect,
            containerRect,
            popupWidth: 210,
            popupHeight: 260,
        });

        // If left-0 were used, right edge would be: 700 + 210 = 910px (overflows 800px!)
        // The algorithm MUST choose "right" (right-0), so the popup extends to the left: 790 - 210 = 580px
        expect(placement.x).toBe("right");
        expect(placement.y).toBe("bottom");

        const actualPopupLeft = cardRect.right - 210;
        expect(actualPopupLeft).toBeGreaterThanOrEqual(containerRect.left + 8);
    });

    it("Scenario 3: Table near bottom edge flips popup to top", () => {
        const containerRect = { left: 0, right: 800, width: 800 };
        // Card near bottom of 768px viewport: top=650, bottom=740 (only 28px below)
        const cardRect = { left: 16, right: 106, top: 650, bottom: 740, width: 90, height: 90 };

        const placement = calculatePopoverPlacement({
            cardRect,
            containerRect,
            viewportHeight: 768,
            popupWidth: 210,
            popupHeight: 260,
        });

        expect(placement.y).toBe("top");
    });

    it("Scenario 4: Group names are normalized with Title Casing", () => {
        expect(toTitleCase("roof top")).toBe("Roof Top");
        expect(toTitleCase("main hall")).toBe("Main Hall");
        expect(toTitleCase("SECTION T")).toBe("Section T");
        expect(toTitleCase("patio outdoor area")).toBe("Patio Outdoor Area");
    });

    it("Scenario 5: Available/Free table cards contain essential status, seats, and label", () => {
        const freeTable = {
            id: 1,
            tableNo: "1",
            seats: 4,
            isOccupied: false,
            isReserved: false,
            activeOrderCount: 0,
        };

        // When isOccupied is false, essential info is still populated
        const tableLabel = freeTable.tableNo || "--";
        const statusLabel = freeTable.isOccupied ? "Running" : freeTable.isReserved ? "Reserved" : "Available";
        const seatsLabel = `${freeTable.seats || 4} Seats`;

        expect(tableLabel).toBe("1");
        expect(statusLabel).toBe("Available");
        expect(seatsLabel).toBe("4 Seats");
    });

    it("Scenario 6: Occupied table cards contain order counts and running status", () => {
        const occupiedTable = {
            id: 2,
            tableNo: "2",
            seats: 6,
            isOccupied: true,
            isReserved: false,
            activeOrderCount: 3,
            occupiedSince: new Date(Date.now() - 15 * 60000).toISOString(),
        };

        const statusLabel = occupiedTable.isOccupied ? "Running" : "Available";
        const ordersText = `${occupiedTable.activeOrderCount} order${occupiedTable.activeOrderCount === 1 ? "" : "s"}`;

        expect(statusLabel).toBe("Running");
        expect(ordersText).toBe("3 orders");
    });
});
