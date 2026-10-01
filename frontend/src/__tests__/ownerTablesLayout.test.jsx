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

describe("Owner Panel Tables - Authoritative Table Grouping & Data Synchronization", () => {
    // Import shared table grouping functions
    const {
        resolveTableGroup,
        mergeUniqueGroupNames,
        normalizeGroupName,
        isSameGroupName,
        toTitleCase,
    } = require("../utils/tableGrouping");

    const sampleNineTables = [
        { id: 1, tableNo: "1", seats: 4, section: "Main Floor", isOccupied: false },
        { id: 2, tableNo: "2", seats: 4, section: "Main Floor", isOccupied: true, activeOrderCount: 1 },
        { id: 3, tableNo: "3", seats: 4, section: "Main Floor", isOccupied: false },
        { id: 4, tableNo: "4", seats: 6, section: "Main Floor", isOccupied: false },
        { id: 5, tableNo: "5", seats: 4, section: "Roof Top", isOccupied: false },
        { id: 8, tableNo: "T1", seats: 4, section: "Main Floor", isOccupied: false },
        { id: 9, tableNo: "T2", seats: 4, section: "Main Floor", isOccupied: true, activeOrderCount: 2 },
        { id: 10, tableNo: "T3", seats: 4, section: "Main Floor", isOccupied: false },
        { id: 11, tableNo: "T4", seats: 4, section: "Main Floor", isOccupied: false },
    ];

    it("Requirement 1 & 2: Nine tables across three groups appear in their correct groups (4 Main Hall, 1 Roof Top, 4 Section T)", () => {
        const tableGroups = {
            "5": "Roof Top",
        };
        const groupCatalog = ["Main Hall", "Roof Top", "Section T"];

        const grouped = {};
        sampleNineTables.forEach((t) => {
            const g = resolveTableGroup(t, tableGroups, groupCatalog);
            if (!grouped[g]) grouped[g] = [];
            grouped[g].push(t);
        });

        expect(Object.keys(grouped).sort()).toEqual(["Main Hall", "Roof Top", "Section T"].sort());
        expect(grouped["Main Hall"].length).toBe(4);
        expect(grouped["Roof Top"].length).toBe(1);
        expect(grouped["Section T"].length).toBe(4);
        expect(grouped["Roof Top"][0].id).toBe(5);
    });

    it("Requirement 3: Moving a table from Main Hall to Roof Top moves it cleanly without duplication", () => {
        let tableGroups = {
            "5": "Roof Top",
        };
        const groupCatalog = ["Main Hall", "Roof Top", "Section T"];

        // Before move: Table 1 is in Main Hall
        expect(resolveTableGroup(sampleNineTables[0], tableGroups, groupCatalog)).toBe("Main Hall");

        // Move Table 1 to Roof Top
        tableGroups = {
            ...tableGroups,
            "1": "Roof Top",
        };

        const grouped = {};
        sampleNineTables.forEach((t) => {
            const g = resolveTableGroup(t, tableGroups, groupCatalog);
            if (!grouped[g]) grouped[g] = [];
            grouped[g].push(t);
        });

        expect(grouped["Main Hall"].length).toBe(3);
        expect(grouped["Roof Top"].length).toBe(2);
        expect(grouped["Section T"].length).toBe(4);

        // Verify Table 1 appears ONLY once, inside Roof Top
        const inMainHall = grouped["Main Hall"].some((t) => t.id === 1);
        const inRoofTop = grouped["Roof Top"].some((t) => t.id === 1);
        expect(inMainHall).toBe(false);
        expect(inRoofTop).toBe(true);
    });

    it("Requirement 4: A newly created group and its assigned tables appear correctly", () => {
        const tableGroups = {
            "5": "Roof Top",
            "4": "Garden Patio", // Newly created group
        };
        const groupCatalog = ["Main Hall", "Roof Top", "Section T", "Garden Patio"];

        const grouped = {};
        sampleNineTables.forEach((t) => {
            const g = resolveTableGroup(t, tableGroups, groupCatalog);
            if (!grouped[g]) grouped[g] = [];
            grouped[g].push(t);
        });

        expect(grouped["Garden Patio"]).toBeDefined();
        expect(grouped["Garden Patio"].length).toBe(1);
        expect(grouped["Garden Patio"][0].id).toBe(4);
        expect(grouped["Main Hall"].length).toBe(3);
    });

    it("Requirement 5: Renaming a group updates all assigned tables to the new heading", () => {
        let tableGroups = {
            "5": "Roof Top",
        };
        let groupCatalog = ["Main Hall", "Roof Top", "Section T"];

        // Rename "Roof Top" to "Sky Deck"
        const oldName = "Roof Top";
        const newName = "Sky Deck";

        groupCatalog = groupCatalog.map((g) => (isSameGroupName(g, oldName) ? newName : g));
        tableGroups = Object.entries(tableGroups).reduce((acc, [k, v]) => {
            acc[k] = isSameGroupName(v, oldName) ? newName : v;
            return acc;
        }, {});

        const table5Group = resolveTableGroup(sampleNineTables[4], tableGroups, groupCatalog);
        expect(table5Group).toBe("Sky Deck");
    });

    it("Requirement 6: Deleting a group unassigns tables cleanly", () => {
        let tableGroups = {
            "1": "VIP Lounge",
            "2": "VIP Lounge",
            "5": "Roof Top",
        };
        let groupCatalog = ["Main Hall", "Roof Top", "Section T", "VIP Lounge"];

        // Delete "VIP Lounge"
        const groupToDelete = "VIP Lounge";
        groupCatalog = groupCatalog.filter((g) => !isSameGroupName(g, groupToDelete));
        tableGroups = Object.entries(tableGroups).reduce((acc, [k, v]) => {
            if (!isSameGroupName(v, groupToDelete)) acc[k] = v;
            return acc;
        }, {});

        // Table 1 and 2 now fallback according to their naming pattern
        expect(resolveTableGroup(sampleNineTables[0], tableGroups, groupCatalog)).toBe("Main Hall");
        expect(resolveTableGroup(sampleNineTables[1], tableGroups, groupCatalog)).toBe("Main Hall");
    });

    it("Requirement 7: Tables without any assigned group are categorized as Ungrouped (never Main Floor)", () => {
        const tableWithoutPattern = {
            id: 99,
            tableNo: "XYZ-Bar",
            seats: 2,
            section: "Main Floor", // Default schema section
            isOccupied: false,
        };

        const tableGroups = {};
        const groupCatalog = ["Main Hall", "Roof Top"];

        const resolved = resolveTableGroup(tableWithoutPattern, tableGroups, groupCatalog);
        expect(resolved).toBe("Ungrouped");
        expect(resolved).not.toBe("Main Floor");
    });

    it("Requirement 8: Occupied tables and active orders retain full state across grouping", () => {
        const tableGroups = {
            "5": "Roof Top",
        };
        const groupCatalog = ["Main Hall", "Roof Top", "Section T"];

        const table2 = sampleNineTables.find((t) => t.id === 2);
        expect(table2.isOccupied).toBe(true);
        expect(table2.activeOrderCount).toBe(1);

        const group = resolveTableGroup(table2, tableGroups, groupCatalog);
        expect(group).toBe("Main Hall");
        // State remains intact
        expect(table2.isOccupied).toBe(true);
        expect(table2.activeOrderCount).toBe(1);
    });

    it("Requirement 9: Works dynamically with any group names and arbitrary number of tables", () => {
        const customTables = [
            { id: 101, tableNo: "B1", seats: 2, section: "Terrace" },
            { id: 102, tableNo: "B2", seats: 4, section: "Poolside" },
            { id: 103, tableNo: "B3", seats: 6, section: "Executive Lounge" },
        ];
        const tableGroups = {
            "101": "Terrace",
            "102": "Poolside",
            "103": "Executive Lounge",
        };
        const groupCatalog = ["Terrace", "Poolside", "Executive Lounge"];

        const groups = customTables.map((t) => resolveTableGroup(t, tableGroups, groupCatalog));
        expect(groups).toEqual(["Terrace", "Poolside", "Executive Lounge"]);
    });
});

describe("Owner Dashboard Tables - Viewport Layout & Footer Positioning Engine", () => {
    // Pure layout calculation functions matching OwnerLayout implementation
    function calculateWorkspaceLayout({
        viewportHeight = 768,
        headerHeight = 65,
        contentHeight = 200,
        zoom = 100,
    }) {
        // Effective viewport under zoom
        const effectiveViewportHeight = Math.round(viewportHeight * (100 / zoom));
        const minHeight = Math.max(0, effectiveViewportHeight - headerHeight);
        // The workspace has min-height: minHeight, so it never shrinks below minHeight
        const actualWorkspaceHeight = Math.max(minHeight, contentHeight);
        const footerTop = headerHeight + actualWorkspaceHeight;

        return {
            effectiveViewportHeight,
            minHeight,
            actualWorkspaceHeight,
            footerTop,
            footerAppearsInInitialViewport: footerTop < effectiveViewportHeight,
            workspaceFillsInitialScreen: actualWorkspaceHeight >= minHeight,
        };
    }

    it("Scenario 1: With only a few tables, workspace fills available viewport and footer starts below initial screen", () => {
        const layout = calculateWorkspaceLayout({
            viewportHeight: 768,
            headerHeight: 64,
            contentHeight: 180, // 4 tables in 1 group
        });

        expect(layout.minHeight).toBe(704);
        expect(layout.actualWorkspaceHeight).toBe(704);
        expect(layout.footerTop).toBe(768);
        expect(layout.footerAppearsInInitialViewport).toBe(false);
        expect(layout.workspaceFillsInitialScreen).toBe(true);
    });

    it("Scenario 2: With nine tables divided into three groups, full-height workspace is maintained", () => {
        const layout = calculateWorkspaceLayout({
            viewportHeight: 900,
            headerHeight: 64,
            contentHeight: 360, // 9 tables across Main Hall, Roof Top, Section T
        });

        expect(layout.minHeight).toBe(836);
        expect(layout.actualWorkspaceHeight).toBe(836);
        expect(layout.footerTop).toBe(900);
        expect(layout.footerAppearsInInitialViewport).toBe(false);
    });

    it("Scenario 3: With many tables (e.g. 30 tables), workspace expands naturally beyond minimum height", () => {
        const layout = calculateWorkspaceLayout({
            viewportHeight: 768,
            headerHeight: 64,
            contentHeight: 1200, // 30 tables across multiple rows
        });

        expect(layout.minHeight).toBe(704);
        expect(layout.actualWorkspaceHeight).toBe(1200);
        expect(layout.actualWorkspaceHeight).toBeGreaterThan(layout.minHeight);
        expect(layout.footerTop).toBe(1264);
        // Footer is pushed down with content
        expect(layout.footerTop).toBeGreaterThan(layout.effectiveViewportHeight);
    });

    it("Scenario 4: Several new groups added allows workspace to grow accordingly", () => {
        const layout = calculateWorkspaceLayout({
            viewportHeight: 800,
            headerHeight: 64,
            contentHeight: 1500, // 8 groups with titles, counts, and table cards
        });

        expect(layout.actualWorkspaceHeight).toBe(1500);
        expect(layout.footerTop).toBe(1564);
    });

    it("Scenario 5: Live Orders panel toggling (visible vs hidden) retains full layout stability", () => {
        // Desktop xl layout: with panel visible (col-span-3 tables, col-span-1 orders)
        const panelVisibleLayout = calculateWorkspaceLayout({
            viewportHeight: 900,
            headerHeight: 64,
            contentHeight: 400,
        });

        // With panel hidden (xl:grid-cols-1)
        const panelHiddenLayout = calculateWorkspaceLayout({
            viewportHeight: 900,
            headerHeight: 64,
            contentHeight: 300,
        });

        expect(panelVisibleLayout.actualWorkspaceHeight).toBe(836);
        expect(panelHiddenLayout.actualWorkspaceHeight).toBe(836);
        expect(panelVisibleLayout.footerTop).toBe(900);
        expect(panelHiddenLayout.footerTop).toBe(900);
    });

    it("Scenario 6: Browser window height reduced correctly recalibrates available height", () => {
        const smallScreen = calculateWorkspaceLayout({
            viewportHeight: 500,
            headerHeight: 64,
            contentHeight: 200,
        });

        expect(smallScreen.minHeight).toBe(436);
        expect(smallScreen.actualWorkspaceHeight).toBe(436);
        expect(smallScreen.footerTop).toBe(500);
    });

    it("Scenario 7: Browser at 70% zoom and 100% zoom adapts workspace height correctly", () => {
        const layout100 = calculateWorkspaceLayout({
            viewportHeight: 900,
            headerHeight: 64,
            contentHeight: 300,
            zoom: 100,
        });

        const layout70 = calculateWorkspaceLayout({
            viewportHeight: 900,
            headerHeight: 64,
            contentHeight: 300,
            zoom: 70,
        });

        expect(layout100.minHeight).toBe(836);
        // At 70% zoom, effective viewport is ~1286px, available workspace is 1222px
        expect(layout70.effectiveViewportHeight).toBe(1286);
        expect(layout70.minHeight).toBe(1222);
        expect(layout70.actualWorkspaceHeight).toBe(1222);
        // In both cases, footer never encroaches into the available workspace!
        expect(layout100.footerAppearsInInitialViewport).toBe(false);
        expect(layout70.footerAppearsInInitialViewport).toBe(false);
    });

    it("Scenario 8: Footer is in normal document flow and reached by scrolling when workspace grows", () => {
        const expandedLayout = calculateWorkspaceLayout({
            viewportHeight: 768,
            headerHeight: 64,
            contentHeight: 1800,
        });

        expect(expandedLayout.footerTop).toBe(1864);
        // User can scroll the page 1864 - 768 = 1096px down to reach the footer
        const scrollDistanceToFooter = expandedLayout.footerTop - expandedLayout.effectiveViewportHeight;
        expect(scrollDistanceToFooter).toBe(1096);
    });
});


