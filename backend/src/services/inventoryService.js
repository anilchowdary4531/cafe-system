import { toBaseUnit, fromBaseUnit, formatDisplayQuantity, isCompatibleUnit, normalizeUnit } from "./unitConversionService.js";
import { getRecipeForOrderItem } from "./recipeService.js";

/**
 * 1. CREATE RAW MATERIAL
 */
export async function createRawMaterial({
    prisma,
    restaurantId,
    name,
    code = null,
    category = "General",
    baseUnit = "g",
    displayUnit = null,
    initialStock = 0,
    minimumStock = 0,
    costPerUnit = 0, // Cost per displayUnit or baseUnit
    actor = null,
} = {}) {
    const rid = Number(restaurantId);
    const cleanName = String(name || "").trim();

    if (!rid || !cleanName) {
        const err = new Error("restaurantId and name are required");
        err.code = "invalid_input";
        throw err;
    }

    const bUnit = normalizeUnit(baseUnit);
    const dUnit = displayUnit ? normalizeUnit(displayUnit) : bUnit;

    const { baseQuantity: initialBaseStock } = toBaseUnit(initialStock, dUnit);
    const { baseQuantity: minBaseStock } = toBaseUnit(minimumStock, dUnit);

    // Calculate cost per base unit
    const { baseQuantity: unitFactor } = toBaseUnit(1, dUnit);
    const costPerBaseUnit = unitFactor > 0 ? Number(costPerUnit || 0) / unitFactor : Number(costPerUnit || 0);

    return await prisma.$transaction(async (tx) => {
        const existing = await tx.rawMaterial.findFirst({
            where: { restaurantId: rid, name: { equals: cleanName, mode: "insensitive" } },
        });

        if (existing) {
            const err = new Error(`Raw material "${cleanName}" already exists`);
            err.code = "duplicate_material";
            throw err;
        }

        const rawMaterial = await tx.rawMaterial.create({
            data: {
                restaurantId: rid,
                name: cleanName,
                code: code ? String(code).trim() : null,
                category: String(category || "General").trim(),
                baseUnit: bUnit,
                displayUnit: dUnit,
                currentStock: initialBaseStock,
                minimumStock: minBaseStock,
                costPerBaseUnit,
            },
        });

        // Record opening stock movement if initialStock > 0
        if (initialBaseStock > 0) {
            await tx.stockMovement.create({
                data: {
                    restaurantId: rid,
                    rawMaterialId: rawMaterial.id,
                    movementType: "OPENING",
                    quantity: initialBaseStock,
                    unitCost: costPerBaseUnit,
                    totalCost: initialBaseStock * costPerBaseUnit,
                    balanceAfter: initialBaseStock,
                    sourceType: "OPENING",
                    sourceId: `RM-${rawMaterial.id}`,
                    notes: "Initial opening stock",
                    performedById: actor?.userId || null,
                    performedByName: actor?.userName || "Staff",
                    idempotencyKey: `RM_OPENING_${rawMaterial.id}`,
                },
            });
        }

        return rawMaterial;
    });
}

/**
 * 2. GET RAW MATERIALS LIST
 */
export async function getRawMaterials({
    prisma,
    restaurantId,
    search = "",
    category = "",
    lowStockOnly = false,
} = {}) {
    const rid = Number(restaurantId);
    if (!rid) return [];

    const where = {
        restaurantId: rid,
        isActive: true,
    };

    if (search) {
        where.OR = [
            { name: { contains: search, mode: "insensitive" } },
            { code: { contains: search, mode: "insensitive" } },
            { category: { contains: search, mode: "insensitive" } },
        ];
    }

    if (category && category !== "All") {
        where.category = { equals: category, mode: "insensitive" };
    }

    const materials = await prisma.rawMaterial.findMany({
        where,
        orderBy: { name: "asc" },
    });

    return materials.map((rm) => {
        const isOut = rm.currentStock <= 0;
        const isLow = !isOut && rm.currentStock <= rm.minimumStock;
        const status = isOut ? "OUT_OF_STOCK" : isLow ? "LOW_STOCK" : "IN_STOCK";

        return {
            ...rm,
            formattedCurrentStock: formatDisplayQuantity(rm.currentStock, rm.baseUnit, rm.displayUnit),
            formattedMinimumStock: formatDisplayQuantity(rm.minimumStock, rm.baseUnit, rm.displayUnit),
            displayStock: fromBaseUnit(rm.currentStock, rm.displayUnit || rm.baseUnit),
            displayMinimumStock: fromBaseUnit(rm.minimumStock, rm.displayUnit || rm.baseUnit),
            unitCost: rm.costPerBaseUnit * toBaseUnit(1, rm.displayUnit || rm.baseUnit).baseQuantity,
            estimatedValuation: Math.max(0, rm.currentStock * rm.costPerBaseUnit),
            status,
        };
    });
}

/**
 * 3. UPDATE RAW MATERIAL
 */
export async function updateRawMaterial({
    prisma,
    restaurantId,
    id,
    data = {},
} = {}) {
    const rid = Number(restaurantId);
    const rmid = Number(id);

    const existing = await prisma.rawMaterial.findFirst({
        where: { id: rmid, restaurantId: rid, isActive: true },
    });
    if (!existing) {
        const err = new Error("Raw material not found");
        err.code = "not_found";
        throw err;
    }

    const updateFields = {};
    if (data.name) updateFields.name = String(data.name).trim();
    if (data.code !== undefined) updateFields.code = data.code ? String(data.code).trim() : null;
    if (data.category) updateFields.category = String(data.category).trim();
    if (data.displayUnit) updateFields.displayUnit = normalizeUnit(data.displayUnit);

    if (data.minimumStock !== undefined) {
        const dUnit = updateFields.displayUnit || existing.displayUnit || existing.baseUnit;
        updateFields.minimumStock = toBaseUnit(Number(data.minimumStock || 0), dUnit).baseQuantity;
    }

    if (data.costPerUnit !== undefined) {
        const dUnit = updateFields.displayUnit || existing.displayUnit || existing.baseUnit;
        const unitFactor = toBaseUnit(1, dUnit).baseQuantity;
        updateFields.costPerBaseUnit = unitFactor > 0 ? Number(data.costPerUnit || 0) / unitFactor : Number(data.costPerUnit || 0);
    }

    return await prisma.rawMaterial.update({
        where: { id: rmid },
        data: updateFields,
    });
}

/**
 * 4. SOFT DELETE RAW MATERIAL
 */
export async function deleteRawMaterial({ prisma, restaurantId, id } = {}) {
    const rid = Number(restaurantId);
    const rmid = Number(id);

    return await prisma.rawMaterial.update({
        where: { id: rmid },
        data: { isActive: false },
    });
}

/**
 * 5. RECORD STOCK-IN / PURCHASE
 */
export async function recordStockIn({
    prisma,
    restaurantId,
    rawMaterialId,
    quantity,
    unit = null,
    totalCost = 0,
    supplierName = null,
    notes = null,
    actor = null,
} = {}) {
    const rid = Number(restaurantId);
    const rmid = Number(rawMaterialId);
    const inputQty = Number(quantity || 0);

    if (!rid || !rmid || inputQty <= 0) {
        const err = new Error("restaurantId, rawMaterialId, and positive quantity are required");
        err.code = "invalid_input";
        throw err;
    }

    return await prisma.$transaction(async (tx) => {
        const rm = await tx.rawMaterial.findFirst({
            where: { id: rmid, restaurantId: rid, isActive: true },
        });
        if (!rm) {
            const err = new Error("Raw material not found");
            err.code = "not_found";
            throw err;
        }

        const inputUnit = unit ? normalizeUnit(unit) : rm.displayUnit || rm.baseUnit;
        if (!isCompatibleUnit(inputUnit, rm.baseUnit)) {
            const err = new Error(`Unit "${inputUnit}" is incompatible with raw material base unit "${rm.baseUnit}"`);
            err.code = "incompatible_unit";
            throw err;
        }

        const { baseQuantity } = toBaseUnit(inputQty, inputUnit);
        const cost = Number(totalCost || 0);
        const unitCost = baseQuantity > 0 ? cost / baseQuantity : rm.costPerBaseUnit;

        const updatedRM = await tx.rawMaterial.update({
            where: { id: rmid },
            data: {
                currentStock: { increment: baseQuantity },
                ...(cost > 0 ? { costPerBaseUnit: unitCost } : {}),
            },
        });

        const movement = await tx.stockMovement.create({
            data: {
                restaurantId: rid,
                rawMaterialId: rmid,
                movementType: "PURCHASE",
                quantity: baseQuantity,
                unitCost,
                totalCost: cost,
                balanceAfter: updatedRM.currentStock,
                sourceType: "PURCHASE",
                sourceId: supplierName ? `SUPPLIER_${supplierName}` : "STOCK_IN",
                notes: notes ? String(notes).trim() : `Stock-in: +${inputQty} ${inputUnit}`,
                performedById: actor?.userId || null,
                performedByName: actor?.userName || "Staff",
            },
        });

        return { rawMaterial: updatedRM, movement };
    });
}

/**
 * 6. RECORD STOCK ADJUSTMENT
 */
export async function recordStockAdjustment({
    prisma,
    restaurantId,
    rawMaterialId,
    quantity,
    unit = null,
    direction = "IN", // "IN" (add) or "OUT" (subtract)
    reason = "Physical count correction",
    actor = null,
} = {}) {
    const rid = Number(restaurantId);
    const rmid = Number(rawMaterialId);
    const inputQty = Number(quantity || 0);
    const dir = String(direction || "IN").toUpperCase();

    if (!rid || !rmid || inputQty <= 0) {
        const err = new Error("restaurantId, rawMaterialId, and positive quantity are required");
        err.code = "invalid_input";
        throw err;
    }

    return await prisma.$transaction(async (tx) => {
        const rm = await tx.rawMaterial.findFirst({
            where: { id: rmid, restaurantId: rid, isActive: true },
        });
        if (!rm) {
            const err = new Error("Raw material not found");
            err.code = "not_found";
            throw err;
        }

        const inputUnit = unit ? normalizeUnit(unit) : rm.displayUnit || rm.baseUnit;
        const { baseQuantity } = toBaseUnit(inputQty, inputUnit);
        const signedQty = dir === "OUT" ? -baseQuantity : baseQuantity;
        const movementType = dir === "OUT" ? "ADJUSTMENT_OUT" : "ADJUSTMENT_IN";

        const updatedRM = await tx.rawMaterial.update({
            where: { id: rmid },
            data: {
                currentStock: { increment: signedQty },
            },
        });

        const movement = await tx.stockMovement.create({
            data: {
                restaurantId: rid,
                rawMaterialId: rmid,
                movementType,
                quantity: signedQty,
                unitCost: rm.costPerBaseUnit,
                totalCost: Math.abs(signedQty) * rm.costPerBaseUnit,
                balanceAfter: updatedRM.currentStock,
                sourceType: "ADJUSTMENT",
                sourceId: `ADJ_${Date.now()}`,
                notes: String(reason || "Stock adjustment").trim(),
                performedById: actor?.userId || null,
                performedByName: actor?.userName || "Staff",
            },
        });

        return { rawMaterial: updatedRM, movement };
    });
}

/**
 * 7. RECORD KITCHEN WASTAGE
 */
export async function recordWastage({
    prisma,
    restaurantId,
    rawMaterialId,
    quantity,
    unit = null,
    reason = "Spoilage / Preparation Waste",
    actor = null,
} = {}) {
    const rid = Number(restaurantId);
    const rmid = Number(rawMaterialId);
    const inputQty = Number(quantity || 0);

    if (!rid || !rmid || inputQty <= 0) {
        const err = new Error("restaurantId, rawMaterialId, and positive quantity are required");
        err.code = "invalid_input";
        throw err;
    }

    return await prisma.$transaction(async (tx) => {
        const rm = await tx.rawMaterial.findFirst({
            where: { id: rmid, restaurantId: rid, isActive: true },
        });
        if (!rm) {
            const err = new Error("Raw material not found");
            err.code = "not_found";
            throw err;
        }

        const inputUnit = unit ? normalizeUnit(unit) : rm.displayUnit || rm.baseUnit;
        const { baseQuantity } = toBaseUnit(inputQty, inputUnit);
        const signedQty = -baseQuantity; // wastage reduces stock

        const updatedRM = await tx.rawMaterial.update({
            where: { id: rmid },
            data: {
                currentStock: { increment: signedQty },
            },
        });

        const movement = await tx.stockMovement.create({
            data: {
                restaurantId: rid,
                rawMaterialId: rmid,
                movementType: "WASTAGE",
                quantity: signedQty,
                unitCost: rm.costPerBaseUnit,
                totalCost: baseQuantity * rm.costPerBaseUnit,
                balanceAfter: updatedRM.currentStock,
                sourceType: "WASTAGE",
                sourceId: `WASTAGE_${Date.now()}`,
                notes: String(reason || "Kitchen wastage").trim(),
                performedById: actor?.userId || null,
                performedByName: actor?.userName || "Staff",
            },
        });

        return { rawMaterial: updatedRM, movement };
    });
}

/**
 * 8. AUTOMATIC STOCK DEDUCTION FOR ORDER
 * Deducts raw material ingredients transactionally for an order.
 * Enforces negative stock policy & idempotency.
 */
export async function deductStockForOrder({
    tx,
    restaurantId,
    orderId,
    orderItems = [],
    actor = null,
} = {}) {
    const rid = Number(restaurantId);
    const oid = Number(orderId);
    if (!tx || !rid || !oid) return;

    const items = Array.isArray(orderItems) ? orderItems : [];
    if (!items.length) return;

    // Fetch restaurant settings for negative stock policy
    const restaurant = await tx.restaurant.findUnique({
        where: { id: rid },
        select: { allowNegativeStock: true },
    });
    const allowNegativeStock = restaurant?.allowNegativeStock ?? true;

    // Resolve ingredients required per rawMaterialId across all order items
    const requiredByMaterial = new Map(); // rawMaterialId -> { rawMaterialId, totalBaseQty, orderItemIds: [] }

    for (const item of items) {
        if (!item.menuItemId) continue;

        const modifierIds = [];
        if (item.selectedModifiers && Array.isArray(item.selectedModifiers)) {
            item.selectedModifiers.forEach((m) => {
                if (m && m.id) modifierIds.push(Number(m.id));
            });
        }

        const { mainRecipe, modifierRecipes } = await getRecipeForOrderItem({
            prisma: tx,
            restaurantId: rid,
            menuItemId: item.menuItemId,
            variantId: item.variantId,
            modifierIds,
        });

        const allRecipes = [mainRecipe, ...modifierRecipes].filter(Boolean);

        for (const recipe of allRecipes) {
            for (const rItem of recipe.items || []) {
                const rmid = Number(rItem.rawMaterialId);
                const itemQty = Math.max(1, Number(item.qty || item.quantity || 1));
                const grossBasePerUnit = rItem.baseQuantity * (1 + (rItem.wastagePercent || 0) / 100);
                const itemTotalBaseQty = grossBasePerUnit * itemQty;

                const curr = requiredByMaterial.get(rmid) || {
                    rawMaterialId: rmid,
                    totalBaseQty: 0,
                    orderItemId: item.id || null,
                };
                curr.totalBaseQty += itemTotalBaseQty;
                requiredByMaterial.set(rmid, curr);
            }
        }
    }

    if (requiredByMaterial.size === 0) return; // No recipe tracked ingredients for this order

    // Fetch current raw material stock with row lock check
    const materialIds = [...requiredByMaterial.keys()];
    const rawMaterials = await tx.rawMaterial.findMany({
        where: { id: { in: materialIds }, restaurantId: rid },
    });
    const rmMap = new Map(rawMaterials.map((rm) => [rm.id, rm]));

    // Verify negative stock policy
    if (!allowNegativeStock) {
        const insufficientMaterials = [];
        for (const [rmid, req] of requiredByMaterial.entries()) {
            const rm = rmMap.get(rmid);
            if (!rm) continue;
            if (rm.currentStock < req.totalBaseQty) {
                insufficientMaterials.push({
                    rawMaterialId: rm.id,
                    name: rm.name,
                    available: rm.currentStock,
                    required: req.totalBaseQty,
                    formattedAvailable: formatDisplayQuantity(rm.currentStock, rm.baseUnit, rm.displayUnit),
                    formattedRequired: formatDisplayQuantity(req.totalBaseQty, rm.baseUnit, rm.displayUnit),
                });
            }
        }

        if (insufficientMaterials.length > 0) {
            const names = insufficientMaterials.map((m) => `${m.name} (req: ${m.formattedRequired}, avail: ${m.formattedAvailable})`).join(", ");
            const err = new Error(`Insufficient raw material stock: ${names}`);
            err.code = "insufficient_raw_material_stock";
            err.insufficientMaterials = insufficientMaterials;
            throw err;
        }
    }

    // Process stock deduction & movements
    for (const [rmid, req] of requiredByMaterial.entries()) {
        const rm = rmMap.get(rmid);
        if (!rm) continue;

        const signedQty = -req.totalBaseQty; // sale decreases stock
        const idempotencyKey = `ORDER_SALE_${oid}_RM_${rmid}`;

        // Check if movement already created for this order item & material (idempotency retry protection)
        const existingMovement = await tx.stockMovement.findUnique({
            where: { idempotencyKey },
        });
        if (existingMovement) continue; // Already deducted for this retry

        const updatedRM = await tx.rawMaterial.update({
            where: { id: rmid },
            data: { currentStock: { increment: signedQty } },
        });

        await tx.stockMovement.create({
            data: {
                restaurantId: rid,
                rawMaterialId: rmid,
                movementType: "SALE",
                quantity: signedQty,
                unitCost: rm.costPerBaseUnit,
                totalCost: req.totalBaseQty * rm.costPerBaseUnit,
                balanceAfter: updatedRM.currentStock,
                sourceType: "ORDER",
                sourceId: String(oid),
                orderItemId: req.orderItemId || null,
                notes: `Automatic deduction for Order #${oid}`,
                performedById: actor?.userId || null,
                performedByName: actor?.userName || "Order Engine",
                idempotencyKey,
            },
        });
    }
}

/**
 * 9. REVERSE STOCK ON ORDER CANCELLATION
 */
export async function reverseStockForOrder({
    tx,
    restaurantId,
    orderId,
    orderItemId = null,
    cancelledQty = null,
    actor = null,
} = {}) {
    const rid = Number(restaurantId);
    const oid = Number(orderId);
    if (!tx || !rid || !oid) return;

    // Find existing SALE movements for this order
    const where = {
        restaurantId: rid,
        sourceType: "ORDER",
        sourceId: String(oid),
        movementType: "SALE",
    };
    if (orderItemId) {
        where.orderItemId = Number(orderItemId);
    }

    const saleMovements = await tx.stockMovement.findMany({
        where,
        include: { rawMaterial: true },
    });

    if (!saleMovements.length) return;

    for (const m of saleMovements) {
        const idempotencyKey = `ORDER_REVERSAL_${oid}_SM_${m.id}`;
        const existingReversal = await tx.stockMovement.findUnique({
            where: { idempotencyKey },
        });
        if (existingReversal) continue;

        // Restore positive stock
        const restoreBaseQty = Math.abs(m.quantity);

        const updatedRM = await tx.rawMaterial.update({
            where: { id: m.rawMaterialId },
            data: { currentStock: { increment: restoreBaseQty } },
        });

        await tx.stockMovement.create({
            data: {
                restaurantId: rid,
                rawMaterialId: m.rawMaterialId,
                movementType: "REVERSAL",
                quantity: restoreBaseQty,
                unitCost: m.unitCost,
                totalCost: restoreBaseQty * m.unitCost,
                balanceAfter: updatedRM.currentStock,
                sourceType: "REVERSAL",
                sourceId: String(oid),
                orderItemId: m.orderItemId,
                notes: `Stock reversal for cancelled Order #${oid}`,
                performedById: actor?.userId || null,
                performedByName: actor?.userName || "Order Engine",
                idempotencyKey,
            },
        });
    }
}

/**
 * 10. GET STOCK MOVEMENT LEDGER
 */
export async function getStockLedger({
    prisma,
    restaurantId,
    rawMaterialId = null,
    movementType = null,
    startDate = null,
    endDate = null,
    limit = 50,
    offset = 0,
} = {}) {
    const rid = Number(restaurantId);
    if (!rid) return { movements: [], total: 0 };

    const where = { restaurantId: rid };

    if (rawMaterialId) {
        where.rawMaterialId = Number(rawMaterialId);
    }
    if (movementType && movementType !== "ALL") {
        where.movementType = String(movementType).toUpperCase();
    }
    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [movements, total] = await Promise.all([
        prisma.stockMovement.findMany({
            where,
            include: { rawMaterial: true },
            orderBy: { createdAt: "desc" },
            take: Number(limit || 50),
            skip: Number(offset || 0),
        }),
        prisma.stockMovement.count({ where }),
    ]);

    return {
        movements: movements.map((m) => ({
            ...m,
            formattedQuantity: formatDisplayQuantity(m.quantity, m.rawMaterial?.baseUnit, m.rawMaterial?.displayUnit),
            formattedBalanceAfter: formatDisplayQuantity(m.balanceAfter, m.rawMaterial?.baseUnit, m.rawMaterial?.displayUnit),
        })),
        total,
    };
}

/**
 * 11. INVENTORY REPORTS & VALUATION
 */
export async function getInventoryReport({ prisma, restaurantId } = {}) {
    const rid = Number(restaurantId);
    if (!rid) return {};

    const materials = await prisma.rawMaterial.findMany({
        where: { restaurantId: rid, isActive: true },
    });

    let totalValuation = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    materials.forEach((rm) => {
        const val = Math.max(0, rm.currentStock * rm.costPerBaseUnit);
        totalValuation += val;

        if (rm.currentStock <= 0) {
            outOfStockCount++;
        } else if (rm.currentStock <= rm.minimumStock) {
            lowStockCount++;
        }
    });

    // Recent 30 days wastage summary
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const wastageMovements = await prisma.stockMovement.findMany({
        where: {
            restaurantId: rid,
            movementType: "WASTAGE",
            createdAt: { gte: thirtyDaysAgo },
        },
        include: { rawMaterial: true },
    });

    let totalWastageCost = 0;
    wastageMovements.forEach((wm) => {
        totalWastageCost += Math.abs(wm.totalCost || 0);
    });

    return {
        totalMaterials: materials.length,
        totalValuation,
        lowStockCount,
        outOfStockCount,
        recentWastageCost30Days: totalWastageCost,
        recentWastageCount: wastageMovements.length,
    };
}

// Backwards compatibility wrappers
export const reserveStockForOrder = async ({ tx, restaurantId, items, orderId, actor } = {}) => {
    if (orderId && Array.isArray(items)) {
        await deductStockForOrder({ tx, restaurantId, orderId, orderItems: items, actor });
    }
};

export const restoreStockForOrder = async ({ tx, restaurantId, items, orderId, actor } = {}) => {
    if (orderId) {
        await reverseStockForOrder({ tx, restaurantId, orderId, actor });
    }
};
