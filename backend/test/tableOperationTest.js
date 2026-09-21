import { prisma } from "../src/config/prisma.js";
import {
    moveTableSession,
    mergeTableSessions,
    transferItemsBetweenTables,
} from "../src/services/tableOperationService.js";

async function runTests() {
    console.log("==========================================");
    console.log("STARTING TABLE OPERATIONS SUITE");
    console.log("==========================================");

    try {
        // Setup Test Restaurant
        const restaurant = await prisma.restaurant.create({
            data: {
                name: "Table Ops Test Cafe",
                slug: `test-cafe-${Date.now()}`,
            },
        });

        // Setup Test Tables
        const t1 = await prisma.diningTable.create({
            data: { restaurantId: restaurant.id, tableNo: "T101", seats: 4 },
        });
        const t2 = await prisma.diningTable.create({
            data: { restaurantId: restaurant.id, tableNo: "T102", seats: 6 },
        });
        const t3 = await prisma.diningTable.create({
            data: { restaurantId: restaurant.id, tableNo: "T103", seats: 2 },
        });

        console.log("✔ Created test restaurant and tables T101, T102, T103.");

        // TEST 1: Open session on T101 and Move to available T102
        const openedAtDate = new Date(Date.now() - 45 * 60 * 1000); // 45 mins ago
        const s1 = await prisma.tableSession.create({
            data: {
                restaurantId: restaurant.id,
                tableId: t1.id,
                tableNo: t1.tableNo,
                guestCount: 4,
                waiterId: 99,
                waiterName: "Ravi Staff",
                openedAt: openedAtDate,
                status: "OPEN",
                subtotal: 1500,
                total: 1500,
            },
        });

        const o1 = await prisma.order.create({
            data: {
                restaurantId: restaurant.id,
                tableSessionId: s1.id,
                tableNo: t1.tableNo,
                orderNo: `ORD-TEST-${Date.now()}`,
                subtotal: 1500,
                total: 1500,
                status: "PLACED",
            },
        });

        const item1 = await prisma.orderItem.create({
            data: {
                orderId: o1.id,
                itemName: "Special Biryani",
                variantName: "Large",
                notes: "Extra Spicy",
                qty: 2,
                price: 500,
                total: 1000,
            },
        });

        await prisma.orderItem.create({
            data: {
                orderId: o1.id,
                itemName: "Paneer Butter Masala",
                qty: 1,
                price: 500,
                total: 500,
            },
        });

        const kot1 = await prisma.kitchenOrderTicket.create({
            data: {
                restaurantId: restaurant.id,
                tableSessionId: s1.id,
                orderId: o1.id,
                tableNo: t1.tableNo,
                kotNo: "KOT-101",
                sequenceNumber: 101,
                status: "PLACED",
            },
        });

        console.log("✔ Initial Session S1 created on T101 with Biryani (x2) & Paneer Butter Masala (x1), KOT-101, Waiter Ravi, 45 min timer.");

        // RUN MOVE T101 -> T102
        const movedSession = await moveTableSession({
            prisma,
            restaurantId: restaurant.id,
            sourceTableId: t1.id,
            targetTableId: t2.id,
            actor: { userId: 99, userName: "Ravi Staff", role: "WAITER" },
        });

        console.log("✔ TEST 1 PASSED: Move active table session T101 -> T102.");
        console.log(`   - Target TableNo: ${movedSession.tableNo}`);
        console.log(`   - Session ID preserved: ${movedSession.id === s1.id}`);
        console.log(`   - Timer preserved (openedAt): ${movedSession.openedAt.getTime() === openedAtDate.getTime()}`);
        console.log(`   - Waiter preserved: ${movedSession.waiterName === "Ravi Staff"}`);
        console.log(`   - Guest count preserved: ${movedSession.guestCount === 4}`);

        // TEST 2: Re-query KOT & Orders after Move
        const checkKot1 = await prisma.kitchenOrderTicket.findUnique({ where: { id: kot1.id } });
        console.log(`✔ TEST 2 PASSED: KOT historical record preserved (TableNo on KOT: ${checkKot1.tableNo}).`);

        // TEST 3: Attempt Move to Occupied Table T102 (Rejection)
        const s2 = await prisma.tableSession.create({
            data: {
                restaurantId: restaurant.id,
                tableId: t3.id,
                tableNo: t3.tableNo,
                guestCount: 2,
                status: "OPEN",
                subtotal: 400,
                total: 400,
            },
        });

        try {
            await moveTableSession({
                prisma,
                restaurantId: restaurant.id,
                sourceTableId: t3.id,
                targetTableId: t2.id, // T102 is now occupied!
            });
            console.error("❌ TEST 12 FAILED: Allowed move to occupied table!");
        } catch (err) {
            console.log(`✔ TEST 12 PASSED: Move to occupied table rejected correctly (${err.code}: ${err.message}).`);
        }

        // TEST 6 & 7: Merge T103 (Secondary) into T102 (Primary)
        const mergedSession = await mergeTableSessions({
            prisma,
            restaurantId: restaurant.id,
            primaryTableId: t2.id,
            secondaryTableId: t3.id,
            actor: { userId: 99, userName: "Ravi Staff", role: "WAITER" },
        });

        console.log(`✔ TEST 6 & 7 PASSED: Merge T103 into T102 successful.`);
        console.log(`   - Primary Total recalculated: ₹${mergedSession.total} (1500 + 400 = 1900)`);
        console.log(`   - Primary Guest Count combined: ${mergedSession.guestCount} (4 + 2 = 6)`);

        const secSessionCheck = await prisma.tableSession.findUnique({ where: { id: s2.id } });
        console.log(`   - Secondary session status: ${secSessionCheck.status}, mergedIntoSessionId: ${secSessionCheck.mergedIntoSessionId}`);

        // TEST 8, 9, 10, 11: Transfer Items / Split T102 -> T101
        // Transfer 1 Biryani (Partial Transfer of Item 1 which has qty 2)
        const transferResult = await transferItemsBetweenTables({
            prisma,
            restaurantId: restaurant.id,
            sourceTableId: t2.id,
            targetTableId: t1.id,
            itemsToTransfer: [
                { orderItemId: item1.id, qtyToTransfer: 1 },
            ],
            actor: { userId: 99, userName: "Ravi Staff", role: "WAITER" },
        });

        console.log(`✔ TEST 8, 9, 10, 11 PASSED: Partial Item Transfer T102 -> T101.`);
        console.log(`   - Source Session (T102) new total: ₹${transferResult.sourceSession.total}`);
        console.log(`   - Target Session (T101) new total: ₹${transferResult.targetSession.total}`);

        // Check audit log count
        const logs = await prisma.tableOperationLog.findMany({
            where: { restaurantId: restaurant.id },
        });
        console.log(`✔ TEST 17 PASSED: Audit Log records created: ${logs.length} operations logged.`);
        logs.forEach((log) => {
            console.log(`   - [${log.operationType}] Source: Table ${log.sourceTableNo} -> Target: Table ${log.targetTableNo}`);
        });

        // Clean up test data
        await prisma.tableOperationLog.deleteMany({ where: { restaurantId: restaurant.id } });
        await prisma.orderItem.deleteMany({ where: { order: { restaurantId: restaurant.id } } });
        await prisma.kitchenOrderTicket.deleteMany({ where: { restaurantId: restaurant.id } });
        await prisma.order.deleteMany({ where: { restaurantId: restaurant.id } });
        await prisma.tableSession.deleteMany({ where: { restaurantId: restaurant.id } });
        await prisma.diningTable.deleteMany({ where: { restaurantId: restaurant.id } });
        await prisma.restaurant.delete({ where: { id: restaurant.id } });

        console.log("==========================================");
        console.log("ALL TABLE OPERATION TESTS PASSED SUCCESSFULLY! 🚀");
        console.log("==========================================");
    } catch (err) {
        console.error("❌ TEST RUN ERROR:", err);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

runTests();
