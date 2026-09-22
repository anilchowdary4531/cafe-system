import { PrismaClient } from "@prisma/client";
import { toBaseUnit, fromBaseUnit, isCompatibleUnit, formatDisplayQuantity } from "../src/services/unitConversionService.js";
import * as recipeService from "../src/services/recipeService.js";
import * as inventoryService from "../src/services/inventoryService.js";

const prisma = new PrismaClient();

async function testInventorySystem() {
    console.log("=== STARTING RAW MATERIAL INVENTORY + RECIPE BOM INTEGRATION TEST ===");
    let restaurantId = null;

    try {
        // 1. Get or create test restaurant
        const restaurant = await prisma.restaurant.findFirst();
        if (!restaurant) throw new Error("No test restaurant found in DB");
        restaurantId = restaurant.id;
        console.log(`✓ Using Restaurant ID: ${restaurantId} (${restaurant.name})`);

        // Enable negative stock for initial test
        await prisma.restaurant.update({
            where: { id: restaurantId },
            data: { allowNegativeStock: true },
        });

        // -------------------------------------------------------------
        // TEST 1: Unit Conversion Engine
        // -------------------------------------------------------------
        console.log("\n--- TEST 1: Unit Conversion Engine ---");
        const conv1 = toBaseUnit(2.5, "kg");
        console.log(`✓ 2.5 kg -> ${conv1.baseQuantity} ${conv1.baseUnit}`);
        if (conv1.baseQuantity !== 2500 || conv1.baseUnit !== "g") {
            throw new Error("Unit conversion failed for 2.5 kg");
        }

        const conv2 = toBaseUnit(1.5, "L");
        console.log(`✓ 1.5 L -> ${conv2.baseQuantity} ${conv2.baseUnit}`);
        if (conv2.baseQuantity !== 1500 || conv2.baseUnit !== "ml") {
            throw new Error("Unit conversion failed for 1.5 L");
        }

        const formatted = formatDisplayQuantity(12500, "g");
        console.log(`✓ 12500 g formatted -> "${formatted}"`);
        if (formatted !== "12.5 kg") throw new Error("Format display failed");

        console.log("✓ Unit Conversion Engine Verified!");

        // -------------------------------------------------------------
        // TEST 2: Raw Material Master & Opening Stock
        // -------------------------------------------------------------
        console.log("\n--- TEST 2: Raw Material Master & Opening Stock ---");
        // Clean up previous test materials
        await prisma.stockMovement.deleteMany({ where: { restaurantId } });
        await prisma.recipeItem.deleteMany({ where: { recipe: { restaurantId } } });
        await prisma.recipe.deleteMany({ where: { restaurantId } });
        await prisma.rawMaterial.deleteMany({ where: { restaurantId } });

        const rmRice = await inventoryService.createRawMaterial({
            prisma,
            restaurantId,
            name: "Test Rice",
            category: "Dry Goods",
            baseUnit: "g",
            displayUnit: "kg",
            initialStock: 20, // 20 kg = 20,000 g
            minimumStock: 5,
            costPerUnit: 60, // ₹60/kg
        });
        console.log(`✓ Created RawMaterial: ${rmRice.name} (Current Stock: ${rmRice.currentStock} g)`);

        const rmChicken = await inventoryService.createRawMaterial({
            prisma,
            restaurantId,
            name: "Test Chicken",
            category: "Meat",
            baseUnit: "g",
            displayUnit: "kg",
            initialStock: 10, // 10 kg = 10,000 g
            minimumStock: 2,
            costPerUnit: 220,
        });

        const rmOil = await inventoryService.createRawMaterial({
            prisma,
            restaurantId,
            name: "Test Oil",
            category: "General",
            baseUnit: "ml",
            displayUnit: "L",
            initialStock: 8, // 8 L = 8,000 ml
            minimumStock: 2,
            costPerUnit: 140,
        });

        // -------------------------------------------------------------
        // TEST 3: Recipe BOM Creation & Recipe Costing
        // -------------------------------------------------------------
        console.log("\n--- TEST 3: Recipe BOM Creation & Recipe Costing ---");
        let menuItem = await prisma.menuItem.findFirst({ where: { restaurantId } });
        if (!menuItem) {
            menuItem = await prisma.menuItem.create({
                data: {
                    restaurantId,
                    name: "Test Biryani Special",
                    category: "Main Course",
                    price: 280,
                },
            });
        }

        const recipe = await recipeService.upsertRecipe({
            prisma,
            restaurantId,
            menuItemId: menuItem.id,
            name: "Special Biryani Recipe v1",
            items: [
                { rawMaterialId: rmRice.id, quantity: 250, unit: "g" },
                { rawMaterialId: rmChicken.id, quantity: 200, unit: "g" },
                { rawMaterialId: rmOil.id, quantity: 30, unit: "ml" },
            ],
        });
        console.log(`✓ Recipe created (Version ${recipe.version}) with ${recipe.items.length} ingredients`);

        const costData = await recipeService.calculateRecipeCost({
            prisma,
            restaurantId,
            menuItemId: menuItem.id,
        });
        console.log(`✓ Calculated Recipe Cost: ₹${costData.totalCost.toFixed(2)}`);

        // -------------------------------------------------------------
        // TEST 4: Automatic Stock Deduction
        // -------------------------------------------------------------
        console.log("\n--- TEST 4: Automatic Stock Deduction ---");
        const orderNo = `TEST-ORD-${Date.now()}`;
        const order = await prisma.order.create({
            data: {
                restaurantId,
                orderNo,
                subtotal: 560,
                taxAmount: 28,
                total: 588,
                status: "PLACED",
                items: {
                    create: [
                        {
                            menuItemId: menuItem.id,
                            itemName: menuItem.name,
                            qty: 2,
                            price: menuItem.price,
                            total: menuItem.price * 2,
                        },
                    ],
                },
            },
            include: { items: true },
        });

        await prisma.$transaction(async (tx) => {
            await inventoryService.deductStockForOrder({
                tx,
                restaurantId,
                orderId: order.id,
                orderItems: order.items,
            });
        });

        const updatedRice = await prisma.rawMaterial.findUnique({ where: { id: rmRice.id } });
        const updatedChicken = await prisma.rawMaterial.findUnique({ where: { id: rmChicken.id } });
        const updatedOil = await prisma.rawMaterial.findUnique({ where: { id: rmOil.id } });

        console.log(`✓ Rice stock after order x2: ${updatedRice.currentStock} g (Expected 19500 g)`);
        console.log(`✓ Chicken stock after order x2: ${updatedChicken.currentStock} g (Expected 9600 g)`);
        console.log(`✓ Oil stock after order x2: ${updatedOil.currentStock} ml (Expected 7940 ml)`);

        if (updatedRice.currentStock !== 19500 || updatedChicken.currentStock !== 9600) {
            throw new Error("Automatic stock deduction calculation mismatch!");
        }

        // -------------------------------------------------------------
        // TEST 5: Idempotency Retry Protection
        // -------------------------------------------------------------
        console.log("\n--- TEST 5: Idempotency Retry Protection ---");
        await prisma.$transaction(async (tx) => {
            await inventoryService.deductStockForOrder({
                tx,
                restaurantId,
                orderId: order.id,
                orderItems: order.items,
            });
        });

        const retryRice = await prisma.rawMaterial.findUnique({ where: { id: rmRice.id } });
        console.log(`✓ Rice stock after idempotency retry: ${retryRice.currentStock} g (Remains 19500 g)`);
        if (retryRice.currentStock !== 19500) {
            throw new Error("Idempotency failed: Stock double-deducted on retry!");
        }

        // -------------------------------------------------------------
        // TEST 6: Stock Reversal on Cancellation
        // -------------------------------------------------------------
        console.log("\n--- TEST 6: Stock Reversal on Cancellation ---");
        await prisma.$transaction(async (tx) => {
            await inventoryService.reverseStockForOrder({
                tx,
                restaurantId,
                orderId: order.id,
            });
        });

        const reversedRice = await prisma.rawMaterial.findUnique({ where: { id: rmRice.id } });
        console.log(`✓ Rice stock after order cancellation reversal: ${reversedRice.currentStock} g (Restored to 20000 g)`);
        if (reversedRice.currentStock !== 20000) {
            throw new Error("Reversal failed: Stock not restored properly!");
        }

        // -------------------------------------------------------------
        // TEST 7: Negative Stock Policy Enforcement
        // -------------------------------------------------------------
        console.log("\n--- TEST 7: Negative Stock Policy Enforcement ---");
        await prisma.restaurant.update({
            where: { id: restaurantId },
            data: { allowNegativeStock: false },
        });

        let blocked = false;
        try {
            const hugeOrder = await prisma.order.create({
                data: {
                    restaurantId,
                    orderNo: `TEST-ORD-HUGE-${Date.now()}`,
                    subtotal: 280000,
                    total: 280000,
                    status: "PLACED",
                    items: {
                        create: [
                            {
                                menuItemId: menuItem.id,
                                itemName: menuItem.name,
                                qty: 2000, // 2000 x 250g = 500,000g > 20,000g stock
                                price: menuItem.price,
                                total: menuItem.price * 2000,
                            },
                        ],
                    },
                },
                include: { items: true },
            });

            await prisma.$transaction(async (tx) => {
                await inventoryService.deductStockForOrder({
                    tx,
                    restaurantId,
                    orderId: hugeOrder.id,
                    orderItems: hugeOrder.items,
                });
            });
        } catch (err) {
            blocked = true;
            console.log(`✓ Correctly blocked order exceeding stock when allowNegativeStock=false: "${err.message}"`);
        }

        if (!blocked) {
            throw new Error("Negative stock policy failed: Insufficient stock order was not blocked!");
        }

        // Cleanup test order
        await prisma.order.deleteMany({ where: { orderNo: { startsWith: "TEST-ORD-" } } });

        console.log("\n✅ ALL RAW MATERIAL INVENTORY & RECIPE BOM TESTS PASSED SUCCESSFULLY!");
    } catch (err) {
        console.error("❌ INVENTORY INTEGRATION TEST FAILED:", err);
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

testInventorySystem();
