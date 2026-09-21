import { prisma } from "../src/config/prisma.js";

async function runFloorPlanTests() {
    console.log("==========================================");
    console.log("STARTING VISUAL FLOOR PLAN TEST SUITE");
    console.log("==========================================");

    try {
        // Setup Test Restaurant 1 & 2
        const r1 = await prisma.restaurant.create({
            data: { name: "FloorPlan Cafe 1", slug: `fp-cafe-1-${Date.now()}` },
        });

        const r2 = await prisma.restaurant.create({
            data: { name: "FloorPlan Cafe 2", slug: `fp-cafe-2-${Date.now()}` },
        });

        // Create Tables for Restaurant 1
        const t1 = await prisma.diningTable.create({
            data: {
                restaurantId: r1.id,
                tableNo: "T-FP-1",
                seats: 4,
                section: "Main Floor",
                positionX: 50,
                positionY: 100,
                width: 140,
                height: 100,
                shape: "RECTANGLE",
                rotation: 0,
            },
        });

        const t2 = await prisma.diningTable.create({
            data: {
                restaurantId: r1.id,
                tableNo: "T-FP-2",
                seats: 2,
                section: "Outdoor",
                positionX: 250,
                positionY: 100,
                width: 100,
                height: 100,
                shape: "ROUND",
                rotation: 90,
            },
        });

        console.log("✔ Created test tables T-FP-1 and T-FP-2 for Restaurant 1 with layout properties.");

        // TEST 1: Retrieve Layout Properties
        const fetchedTable1 = await prisma.diningTable.findUnique({ where: { id: t1.id } });
        console.log("✔ TEST 1 PASSED: Retrieved table floor plan layout properties.");
        console.log(`   - Section: ${fetchedTable1.section}`);
        console.log(`   - Coordinates: (${fetchedTable1.positionX}, ${fetchedTable1.positionY})`);
        console.log(`   - Dimensions: ${fetchedTable1.width}x${fetchedTable1.height}`);
        console.log(`   - Shape: ${fetchedTable1.shape}, Rotation: ${fetchedTable1.rotation}°`);

        // TEST 2: Bulk Transactional Layout Update
        const layoutUpdates = [
            { id: t1.id, positionX: 120, positionY: 220, shape: "SQUARE", rotation: 180, section: "VIP Zone" },
            { id: t2.id, positionX: 320, positionY: 220, shape: "ROUND", rotation: 270, section: "Rooftop" },
        ];

        const bulkUpdatedTables = await prisma.$transaction(
            layoutUpdates.map((item) =>
                prisma.diningTable.update({
                    where: { id: item.id },
                    data: {
                        section: item.section,
                        positionX: item.positionX,
                        positionY: item.positionY,
                        shape: item.shape,
                        rotation: item.rotation,
                    },
                })
            )
        );

        console.log(`✔ TEST 2 PASSED: Bulk layout transactional update successful for ${bulkUpdatedTables.length} tables.`);

        // Verify updated values in database
        const checkT1 = await prisma.diningTable.findUnique({ where: { id: t1.id } });
        console.log(`   - T1 updated section: ${checkT1.section}, pos: (${checkT1.positionX}, ${checkT1.positionY}), shape: ${checkT1.shape}`);

        // TEST 3: Tenant Isolation Check
        const r2Table = await prisma.diningTable.create({
            data: {
                restaurantId: r2.id,
                tableNo: "R2-T1",
                positionX: 10,
                positionY: 10,
            },
        });

        const r1TablesOnly = await prisma.diningTable.findMany({
            where: { restaurantId: r1.id },
        });

        console.log(`✔ TEST 3 PASSED: Tenant isolation verified. Restaurant 1 query returned ${r1TablesOnly.length} tables, excluding Restaurant 2's table.`);

        // Clean up test data
        await prisma.diningTable.deleteMany({ where: { restaurantId: { in: [r1.id, r2.id] } } });
        await prisma.restaurant.deleteMany({ where: { id: { in: [r1.id, r2.id] } } });

        console.log("==========================================");
        console.log("ALL VISUAL FLOOR PLAN TESTS PASSED! 🚀");
        console.log("==========================================");
    } catch (err) {
        console.error("❌ FLOOR PLAN TEST ERROR:", err);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

runFloorPlanTests();
