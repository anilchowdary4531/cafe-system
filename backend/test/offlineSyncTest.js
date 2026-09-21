import { prisma } from "../src/config/prisma.js";
import { processOfflineSyncBatch } from "../src/services/offlineSyncService.js";

async function runOfflineSyncTests() {
    console.log("==========================================");
    console.log("STARTING OFFLINE POS & SYNC ENGINE SUITE");
    console.log("==========================================");

    try {
        // Setup Test Restaurant & Table
        const restaurant = await prisma.restaurant.create({
            data: {
                name: "Offline POS Test Cafe",
                slug: `offline-test-${Date.now()}`,
            },
        });

        const table = await prisma.diningTable.create({
            data: { restaurantId: restaurant.id, tableNo: "T-OFFLINE", seats: 4 },
        });

        console.log("✔ Created test restaurant and table T-OFFLINE.");

        const testOpKey1 = `OP-SESSION-${Date.now()}`;
        const testOpKey2 = `OP-ORDER-${Date.now()}`;
        const testOpKey3 = `OP-KOT-${Date.now()}`;

        // ----------------------------------------------------
        // TEST 1: SYNC BATCH CREATION (CREATE_TABLE_SESSION, ADD_ITEMS, CREATE_KOT)
        // ----------------------------------------------------
        console.log("\n--- TEST 1: Offline Sync Batch Execution ---");
        const batch1 = [
            {
                operationId: testOpKey1,
                clientOperationId: testOpKey1,
                type: "CREATE_TABLE_SESSION",
                payload: { tableId: table.id, tableNo: "T-OFFLINE", guestCount: 2 },
            },
            {
                operationId: testOpKey2,
                clientOperationId: testOpKey2,
                type: "ADD_ITEMS_TO_SESSION",
                payload: {
                    tableId: table.id,
                    items: [{ itemName: "Offline Burger", qty: 2, price: 150 }],
                    notes: "Offline test order",
                },
            },
        ];

        const syncRes1 = await processOfflineSyncBatch({
            prisma,
            restaurantId: restaurant.id,
            operations: batch1,
            actor: { userId: 1, userName: "Offline Cashier", role: "ADMIN" },
        });

        if (syncRes1.processedCount !== 2) throw new Error("Expected 2 processed operations");
        if (syncRes1.results[0].status !== "SYNCED") throw new Error("Session creation sync failed");
        if (syncRes1.results[1].status !== "SYNCED") throw new Error("Order item sync failed");

        const createdSessionId = syncRes1.results[0].serverEntityId;
        const createdOrderId = syncRes1.results[1].serverEntityId;

        console.log(`✔ Synced offline batch successfully! Session ID: ${createdSessionId}, Order ID: ${createdOrderId}`);

        // ----------------------------------------------------
        // TEST 2: IDEMPOTENT DUPLICATE SYNC RETRY (0 DUPLICATES)
        // ----------------------------------------------------
        console.log("\n--- TEST 2: Idempotent Duplicate Sync Retry ---");
        const syncRes2 = await processOfflineSyncBatch({
            prisma,
            restaurantId: restaurant.id,
            operations: batch1, // Same batch retried!
        });

        if (!syncRes2.results[0].idempotentRetried) throw new Error("Expected session retry to be idempotent");
        if (!syncRes2.results[1].idempotentRetried) throw new Error("Expected order retry to be idempotent");
        if (syncRes2.results[0].serverEntityId !== createdSessionId) throw new Error("Retry returned different session ID!");
        if (syncRes2.results[1].serverEntityId !== createdOrderId) throw new Error("Retry returned different order ID!");

        // Verify database order count for this session
        const dbOrders = await prisma.order.findMany({ where: { tableSessionId: createdSessionId } });
        if (dbOrders.length !== 1) throw new Error(`Expected exactly 1 order in DB, got ${dbOrders.length}`);
        console.log("✔ Idempotent sync retry verified: exactly 1 order created in DB, duplicate retry safely returned original records.");

        // ----------------------------------------------------
        // TEST 3: OFFLINE KOT CREATION & IDEMPOTENCY
        // ----------------------------------------------------
        console.log("\n--- TEST 3: Offline KOT Creation & Idempotency ---");
        const batchKOT = [
            {
                operationId: testOpKey3,
                clientOperationId: testOpKey3,
                type: "CREATE_KOT",
                payload: { orderId: createdOrderId, items: [{ itemName: "Offline Burger", qty: 2 }] },
            },
        ];

        const kotRes1 = await processOfflineSyncBatch({
            prisma,
            restaurantId: restaurant.id,
            operations: batchKOT,
        });

        if (kotRes1.results[0].status !== "SYNCED") throw new Error("KOT sync failed");
        const createdKotId = kotRes1.results[0].serverEntityId;

        // Retry same KOT
        const kotRes2 = await processOfflineSyncBatch({
            prisma,
            restaurantId: restaurant.id,
            operations: batchKOT,
        });

        if (!kotRes2.results[0].idempotentRetried) throw new Error("KOT retry should be idempotent");
        if (kotRes2.results[0].serverEntityId !== createdKotId) throw new Error("KOT retry returned different ID");
        console.log(`✔ Offline KOT created (ID: ${createdKotId}) and retry verified idempotent.`);

        // ----------------------------------------------------
        // TEST 4: CONFLICT DETECTION (TABLE_SESSION_ALREADY_ACTIVE)
        // ----------------------------------------------------
        console.log("\n--- TEST 4: Table Session Conflict Detection ---");
        const conflictOpKey = `OP-CONFLICT-${Date.now()}`;
        const conflictBatch = [
            {
                operationId: conflictOpKey,
                clientOperationId: conflictOpKey,
                type: "CREATE_TABLE_SESSION",
                payload: { tableId: table.id, tableNo: "T-OFFLINE", guestCount: 4 }, // Table T-OFFLINE is already occupied on server!
            },
        ];

        const conflictRes = await processOfflineSyncBatch({
            prisma,
            restaurantId: restaurant.id,
            operations: conflictBatch,
        });

        if (conflictRes.results[0].status !== "CONFLICT") throw new Error("Expected CONFLICT status for already active table session");
        if (conflictRes.results[0].conflictType !== "TABLE_SESSION_ALREADY_ACTIVE") throw new Error("Expected TABLE_SESSION_ALREADY_ACTIVE conflictType");
        console.log("✔ Table Session conflict correctly detected: ", conflictRes.results[0].message);

        // Cleanup
        console.log("\nCleaning up test data...");
        await prisma.kitchenOrderTicketItem.deleteMany({ where: { kot: { restaurantId: restaurant.id } } });
        await prisma.kitchenOrderTicket.deleteMany({ where: { restaurantId: restaurant.id } });
        await prisma.payment.deleteMany({ where: { restaurantId: restaurant.id } });
        await prisma.orderItem.deleteMany({ where: { order: { restaurantId: restaurant.id } } });
        await prisma.order.deleteMany({ where: { restaurantId: restaurant.id } });
        await prisma.tableSession.deleteMany({ where: { restaurantId: restaurant.id } });
        await prisma.diningTable.deleteMany({ where: { restaurantId: restaurant.id } });
        await prisma.restaurant.deleteMany({ where: { id: restaurant.id } });

        console.log("==========================================");
        console.log("ALL OFFLINE POS & SYNC ENGINE TESTS PASSED!");
        console.log("==========================================");
    } catch (error) {
        console.error("❌ TEST FAILED:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

runOfflineSyncTests();
