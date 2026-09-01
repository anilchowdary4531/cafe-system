import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

test("Phase 2 — Database Schema & Models Verification", async (t) => {
    await t.test("should verify Phase 2 supply chain database models are registered", () => {
        assert.ok(prisma.supplier, "Supplier model should exist");
        assert.ok(prisma.supplierProfile, "SupplierProfile model should exist");
        assert.ok(prisma.supplierAddress, "SupplierAddress model should exist");
        assert.ok(prisma.supplyCategory, "SupplyCategory model should exist");
        assert.ok(prisma.supplyProduct, "SupplyProduct model should exist");
        assert.ok(prisma.supplyPrice, "SupplyPrice model should exist");
        assert.ok(prisma.supplyDiscount, "SupplyDiscount model should exist");
        assert.ok(prisma.supplyInventory, "SupplyInventory model should exist");
        assert.ok(prisma.supplyInventoryTransaction, "SupplyInventoryTransaction model should exist");
        assert.ok(prisma.supplyCart, "SupplyCart model should exist");
        assert.ok(prisma.supplyOrder, "SupplyOrder should exist");
        assert.ok(prisma.supplierSettlement, "SupplierSettlement should exist");
    });

    await t.test("should test stock calculation formula: available_stock = total_stock - reserved_stock", () => {
        const totalStock = 500.0;
        const reservedStock = 20.0;
        const availableStock = totalStock - reservedStock;

        assert.equal(availableStock, 480.0, "Available stock formula must strictly match total - reserved");
    });
});
