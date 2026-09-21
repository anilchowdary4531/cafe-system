import { prisma } from "../src/config/prisma.js";
import {
    createOrUpdateBillSplits,
    recordSessionPayment,
} from "../src/services/splitBillingService.js";

async function runSplitBillingTests() {
    console.log("==========================================");
    console.log("STARTING SPLIT BILLING & MULTI-PAYMENT SUITE");
    console.log("==========================================");

    try {
        // Setup Test Restaurant
        const restaurant = await prisma.restaurant.create({
            data: {
                name: "Split Billing Test Cafe",
                slug: `split-test-${Date.now()}`,
            },
        });

        // Setup Test Table
        const table = await prisma.diningTable.create({
            data: { restaurantId: restaurant.id, tableNo: "TB-12", seats: 4 },
        });

        console.log("✔ Created test restaurant and table TB-12.");

        // Create Test Table Session with Order Items:
        // Item 1: 2 x Pizza Large @ 500 = 1000
        // Item 2: 2 x Burger @ 200 = 400
        // Item 3: 4 x Coke @ 50 = 200
        // Subtotal = 1600, Tax = 80, Service = 40, Discount = 120 -> Grand Total = 1600 + 80 + 40 - 120 = 1600
        const session = await prisma.tableSession.create({
            data: {
                restaurantId: restaurant.id,
                tableId: table.id,
                tableNo: table.tableNo,
                guestCount: 4,
                openedAt: new Date(),
                status: "OPEN",
                subtotal: 1600,
                taxAmount: 80,
                serviceChargeAmount: 40,
                discountAmount: 120,
                total: 1600,
            },
        });

        const order = await prisma.order.create({
            data: {
                restaurantId: restaurant.id,
                tableSessionId: session.id,
                tableNo: table.tableNo,
                orderNo: `ORD-SPLIT-${Date.now()}`,
                subtotal: 1600,
                taxAmount: 80,
                serviceChargeAmount: 40,
                discountAmount: 120,
                total: 1600,
                status: "PLACED",
                items: {
                    create: [
                        { itemName: "Pizza Large", qty: 2, price: 500, total: 1000 },
                        { itemName: "Burger", qty: 2, price: 200, total: 400 },
                        { itemName: "Coke", qty: 4, price: 50, total: 200 },
                    ],
                },
            },
            include: { items: true },
        });

        const items = order.items;
        const pizzaItem = items.find((i) => i.itemName === "Pizza Large");
        const burgerItem = items.find((i) => i.itemName === "Burger");
        const cokeItem = items.find((i) => i.itemName === "Coke");

        console.log("✔ Created test session with subtotal=1600, grandTotal=1600, 3 order items.");

        // ----------------------------------------------------
        // TEST 1: MODE A - SPLIT BY ITEM
        // ----------------------------------------------------
        console.log("\n--- TEST 1: Mode A (Split by Item) ---");
        const itemSplits = await createOrUpdateBillSplits({
            prisma,
            restaurantId: restaurant.id,
            tableSessionId: session.id,
            splitType: "ITEM",
            splitsInput: [
                { label: "Customer A", items: [{ orderItemId: pizzaItem.id, qty: 2 }] },
                { label: "Customer B", items: [{ orderItemId: burgerItem.id, qty: 2 }, { orderItemId: cokeItem.id, qty: 4 }] },
            ],
            actor: { userId: 1, userName: "Cashier", role: "ADMIN" },
        });

        if (itemSplits.length !== 2) throw new Error("Expected 2 splits for Mode A");
        console.log(`✔ Mode A created ${itemSplits.length} splits:`);
        itemSplits.forEach((s) => console.log(`   Split #${s.splitNo} (${s.label}): Total ₹${s.total}`));

        // ----------------------------------------------------
        // TEST 2: MODE B - SPLIT BY QUANTITY & OVER-ALLOCATION PREVENTED
        // ----------------------------------------------------
        console.log("\n--- TEST 2: Mode B (Split by Quantity & Quantity Over-Allocation Guard) ---");
        try {
            await createOrUpdateBillSplits({
                prisma,
                restaurantId: restaurant.id,
                tableSessionId: session.id,
                splitType: "QUANTITY",
                splitsInput: [
                    { label: "Guest 1", items: [{ orderItemId: cokeItem.id, qty: 3 }] },
                    { label: "Guest 2", items: [{ orderItemId: cokeItem.id, qty: 3 }] }, // Total 6 Coke > 4 Coke
                ],
            });
            throw new Error("Quantity over-allocation guard failed to trigger");
        } catch (err) {
            if (err.code === "qty_exceeded") {
                console.log("✔ Quantity over-allocation correctly rejected: ", err.message);
            } else {
                throw err;
            }
        }

        // Valid Quantity Split
        const qtySplits = await createOrUpdateBillSplits({
            prisma,
            restaurantId: restaurant.id,
            tableSessionId: session.id,
            splitType: "QUANTITY",
            splitsInput: [
                { label: "Guest 1", items: [{ orderItemId: cokeItem.id, qty: 2 }, { orderItemId: pizzaItem.id, qty: 1 }] },
                { label: "Guest 2", items: [{ orderItemId: cokeItem.id, qty: 2 }, { orderItemId: pizzaItem.id, qty: 1 }, { orderItemId: burgerItem.id, qty: 2 }] },
            ],
        });
        if (qtySplits.length !== 2) throw new Error("Expected 2 splits for Mode B");
        console.log("✔ Valid quantity split created successfully.");

        // ----------------------------------------------------
        // TEST 3: MODE C - EQUAL SPLIT
        // ----------------------------------------------------
        console.log("\n--- TEST 3: Mode C (Equal Split) ---");
        const equalSplits = await createOrUpdateBillSplits({
            prisma,
            restaurantId: restaurant.id,
            tableSessionId: session.id,
            splitType: "EQUAL",
            splitCount: 4,
        });
        if (equalSplits.length !== 4) throw new Error("Expected 4 equal splits");
        if (equalSplits[0].total !== 400) throw new Error(`Expected equal split total 400, got ${equalSplits[0].total}`);
        console.log(`✔ Mode C equal split created 4 splits of ₹${equalSplits[0].total} each.`);

        // ----------------------------------------------------
        // TEST 4: MODE D - CUSTOM AMOUNT SPLIT & SUM MISMATCH GUARD
        // ----------------------------------------------------
        console.log("\n--- TEST 4: Mode D (Custom Amount Split & Mismatch Guard) ---");
        try {
            await createOrUpdateBillSplits({
                prisma,
                restaurantId: restaurant.id,
                tableSessionId: session.id,
                splitType: "CUSTOM",
                customAmounts: [500, 500], // Sum = 1000 != Session Total 1600
            });
            throw new Error("Custom amount sum mismatch guard failed");
        } catch (err) {
            if (err.code === "custom_sum_mismatch") {
                console.log("✔ Custom sum mismatch correctly rejected: ", err.message);
            } else {
                throw err;
            }
        }

        const customSplits = await createOrUpdateBillSplits({
            prisma,
            restaurantId: restaurant.id,
            tableSessionId: session.id,
            splitType: "CUSTOM",
            customAmounts: [600, 1000],
        });
        if (customSplits.length !== 2) throw new Error("Expected 2 custom splits");
        console.log("✔ Valid custom splits created: ₹600 and ₹1000.");

        // ----------------------------------------------------
        // TEST 5: PARTIAL PAYMENT & CASH CHANGE CALCULATION
        // ----------------------------------------------------
        console.log("\n--- TEST 5: Partial Payment & Cash Change Calculation ---");
        const payResult1 = await recordSessionPayment({
            prisma,
            restaurantId: restaurant.id,
            tableSessionId: session.id,
            billSplitId: customSplits[0].id,
            paymentMode: "CASH",
            amount: 600,
            amountReceived: 1000, // Customer gave ₹1000 for ₹600 split -> Change ₹400
            actor: { userId: 1, userName: "Cashier", role: "ADMIN" },
        });

        if (payResult1.payment.changeAmount !== 400) throw new Error(`Expected change 400, got ${payResult1.payment.changeAmount}`);
        if (payResult1.remainingBalance !== 1000) throw new Error(`Expected remaining balance 1000, got ${payResult1.remainingBalance}`);
        if (payResult1.isFullyPaid) throw new Error("Session should NOT be closed on partial payment");
        console.log("✔ Partial Cash Payment recorded. Change calculated: ₹400. Session remaining balance: ₹1000.");

        // ----------------------------------------------------
        // TEST 6: IDEMPOTENCY SAFETY
        // ----------------------------------------------------
        console.log("\n--- TEST 6: Idempotency Key Safety ---");
        const testIdempotencyKey = `IDEM-PAY-${Date.now()}`;
        const payResult2a = await recordSessionPayment({
            prisma,
            restaurantId: restaurant.id,
            tableSessionId: session.id,
            billSplitId: customSplits[1].id,
            paymentMode: "UPI",
            amount: 500,
            idempotencyKey: testIdempotencyKey,
        });

        // Retry same idempotency key
        const payResult2b = await recordSessionPayment({
            prisma,
            restaurantId: restaurant.id,
            tableSessionId: session.id,
            billSplitId: customSplits[1].id,
            paymentMode: "UPI",
            amount: 500,
            idempotencyKey: testIdempotencyKey,
        });

        if (!payResult2b.idempotentRetried) throw new Error("Expected idempotent response on retry");
        if (payResult2a.payment.id !== payResult2b.payment.id) throw new Error("Idempotent retry returned different payment record");
        console.log("✔ Idempotent payment retry safely recognized and returned existing payment.");

        // ----------------------------------------------------
        // TEST 7: OVERPAYMENT REJECTION
        // ----------------------------------------------------
        console.log("\n--- TEST 7: Overpayment Rejection ---");
        try {
            await recordSessionPayment({
                prisma,
                restaurantId: restaurant.id,
                tableSessionId: session.id,
                paymentMode: "CARD",
                amount: 9999, // Exceeds remaining ₹500
            });
            throw new Error("Overpayment guard failed to trigger");
        } catch (err) {
            if (err.code === "overpayment_rejected") {
                console.log("✔ Overpayment correctly rejected: ", err.message);
            } else {
                throw err;
            }
        }

        // ----------------------------------------------------
        // TEST 8: FINAL SETTLEMENT & TABLE SESSION CLOSURE
        // ----------------------------------------------------
        console.log("\n--- TEST 8: Final Settlement & Table Session Closure ---");
        const finalPayResult = await recordSessionPayment({
            prisma,
            restaurantId: restaurant.id,
            tableSessionId: session.id,
            billSplitId: customSplits[1].id,
            paymentMode: "CARD",
            amount: 500,
        });

        if (!finalPayResult.isFullyPaid) throw new Error("Session should be fully paid after final settlement");
        if (finalPayResult.session.status !== "PAID") throw new Error(`Expected session status PAID, got ${finalPayResult.session.status}`);
        console.log("✔ Final Payment recorded. Session status transition to PAID verified.");

        // Cleanup
        console.log("\nCleaning up test data...");
        await prisma.payment.deleteMany({ where: { restaurantId: restaurant.id } });
        await prisma.billSplitItem.deleteMany({ where: { billSplit: { restaurantId: restaurant.id } } });
        await prisma.billSplit.deleteMany({ where: { restaurantId: restaurant.id } });
        await prisma.tableOperationLog.deleteMany({ where: { restaurantId: restaurant.id } });
        await prisma.orderItem.deleteMany({ where: { order: { restaurantId: restaurant.id } } });
        await prisma.order.deleteMany({ where: { restaurantId: restaurant.id } });
        await prisma.tableSession.deleteMany({ where: { restaurantId: restaurant.id } });
        await prisma.diningTable.deleteMany({ where: { restaurantId: restaurant.id } });
        await prisma.restaurant.deleteMany({ where: { id: restaurant.id } });

        console.log("==========================================");
        console.log("ALL SPLIT BILLING & MULTI-PAYMENT TESTS PASSED!");
        console.log("==========================================");
    } catch (error) {
        console.error("❌ TEST FAILED:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

runSplitBillingTests();
