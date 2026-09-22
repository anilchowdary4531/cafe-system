import { toBaseUnit, isCompatibleUnit } from "./unitConversionService.js";

/**
 * 1. UPSERT RECIPE / BOM
 * Creates or updates recipe version for MenuItem, MenuItemVariant, or MenuItemModifier.
 */
export async function upsertRecipe({
    prisma,
    restaurantId,
    menuItemId = null,
    variantId = null,
    modifierId = null,
    name = null,
    items = [],
} = {}) {
    const rid = Number(restaurantId);
    if (!rid) {
        const err = new Error("restaurantId is required");
        err.code = "invalid_input";
        throw err;
    }

    const mId = menuItemId ? Number(menuItemId) : null;
    const vId = variantId ? Number(variantId) : null;
    const modId = modifierId ? Number(modifierId) : null;

    if (!mId && !vId && !modId) {
        const err = new Error("One of menuItemId, variantId, or modifierId must be specified for recipe");
        err.code = "invalid_input";
        throw err;
    }

    const recipeItemsInput = Array.isArray(items) ? items : [];

    // Validate raw materials and units
    const rawMaterialIds = [...new Set(recipeItemsInput.map((i) => Number(i.rawMaterialId || 0)).filter(Boolean))];
    const rawMaterials = await prisma.rawMaterial.findMany({
        where: { id: { in: rawMaterialIds }, restaurantId: rid },
    });
    const rmMap = new Map(rawMaterials.map((rm) => [rm.id, rm]));

    const processedItems = recipeItemsInput.map((item) => {
        const rmid = Number(item.rawMaterialId);
        const rm = rmMap.get(rmid);
        if (!rm) {
            const err = new Error(`Raw material ID ${rmid} not found in restaurant inventory`);
            err.code = "raw_material_not_found";
            throw err;
        }

        const qty = Number(item.quantity || 0);
        if (qty <= 0) {
            const err = new Error(`Quantity for ingredient "${rm.name}" must be greater than 0`);
            err.code = "invalid_quantity";
            throw err;
        }

        const unit = String(item.unit || rm.baseUnit).trim();
        if (!isCompatibleUnit(unit, rm.baseUnit)) {
            const err = new Error(`Unit "${unit}" for "${rm.name}" is incompatible with raw material base unit "${rm.baseUnit}"`);
            err.code = "incompatible_unit";
            throw err;
        }

        const { baseQuantity } = toBaseUnit(qty, unit);

        return {
            rawMaterialId: rm.id,
            quantity: qty,
            unit,
            baseQuantity,
            wastagePercent: Number(item.wastagePercent || 0),
        };
    });

    return await prisma.$transaction(async (tx) => {
        // Find existing recipe if any
        let existing = null;
        if (vId) {
            existing = await tx.recipe.findFirst({
                where: { restaurantId: rid, variantId: vId, isActive: true },
            });
        } else if (modId) {
            existing = await tx.recipe.findFirst({
                where: { restaurantId: rid, modifierId: modId, isActive: true },
            });
        } else if (mId) {
            existing = await tx.recipe.findFirst({
                where: { restaurantId: rid, menuItemId: mId, variantId: null, modifierId: null, isActive: true },
            });
        }

        let recipe = null;
        if (existing) {
            // Update version and clear old items
            await tx.recipeItem.deleteMany({ where: { recipeId: existing.id } });
            recipe = await tx.recipe.update({
                where: { id: existing.id },
                data: {
                    name: name || existing.name,
                    version: existing.version + 1,
                    items: {
                        create: processedItems,
                    },
                },
                include: {
                    items: {
                        include: { rawMaterial: true },
                    },
                },
            });
        } else {
            // Create new recipe (version 1)
            recipe = await tx.recipe.create({
                data: {
                    restaurantId: rid,
                    menuItemId: mId,
                    variantId: vId,
                    modifierId: modId,
                    name: name || null,
                    version: 1,
                    items: {
                        create: processedItems,
                    },
                },
                include: {
                    items: {
                        include: { rawMaterial: true },
                    },
                },
            });
        }

        return recipe;
    });
}

/**
 * 2. GET ACTIVE RECIPES FOR MENU ITEM / VARIANT / MODIFIERS
 */
export async function getRecipeForOrderItem({
    prisma,
    restaurantId,
    menuItemId,
    variantId = null,
    modifierIds = [],
} = {}) {
    const rid = Number(restaurantId);
    const mId = Number(menuItemId);
    const vId = variantId ? Number(variantId) : null;
    const modIds = Array.isArray(modifierIds)
        ? modifierIds.map((id) => Number(id)).filter(Boolean)
        : [];

    let recipe = null;

    // Check variant recipe first
    if (vId) {
        recipe = await prisma.recipe.findFirst({
            where: { restaurantId: rid, variantId: vId, isActive: true },
            include: {
                items: { include: { rawMaterial: true } },
            },
        });
    }

    // Fallback to base menuItem recipe if no variant recipe found
    if (!recipe && mId) {
        recipe = await prisma.recipe.findFirst({
            where: { restaurantId: rid, menuItemId: mId, variantId: null, modifierId: null, isActive: true },
            include: {
                items: { include: { rawMaterial: true } },
            },
        });
    }

    // Fetch modifier recipes
    let modifierRecipes = [];
    if (modIds.length > 0) {
        modifierRecipes = await prisma.recipe.findMany({
            where: { restaurantId: rid, modifierId: { in: modIds }, isActive: true },
            include: {
                items: { include: { rawMaterial: true } },
            },
        });
    }

    return {
        mainRecipe: recipe,
        modifierRecipes,
    };
}

/**
 * 3. CALCULATE RECIPE COST
 * Estimates food cost based on rawMaterial.costPerBaseUnit
 */
export async function calculateRecipeCost({ prisma, restaurantId, menuItemId, variantId = null } = {}) {
    const { mainRecipe, modifierRecipes } = await getRecipeForOrderItem({
        prisma,
        restaurantId,
        menuItemId,
        variantId,
    });

    let totalCost = 0;
    const ingredientBreakdown = [];

    const allRecipes = [mainRecipe, ...modifierRecipes].filter(Boolean);

    for (const r of allRecipes) {
        for (const item of r.items || []) {
            const rm = item.rawMaterial;
            if (!rm) continue;
            const grossBaseQty = item.baseQuantity * (1 + (item.wastagePercent || 0) / 100);
            const itemCost = grossBaseQty * (rm.costPerBaseUnit || 0);

            totalCost += itemCost;
            ingredientBreakdown.push({
                rawMaterialId: rm.id,
                rawMaterialName: rm.name,
                baseQuantity: item.baseQuantity,
                wastagePercent: item.wastagePercent,
                grossBaseQuantity: grossBaseQty,
                unit: item.unit,
                costPerBaseUnit: rm.costPerBaseUnit,
                totalCost: itemCost,
            });
        }
    }

    return {
        totalCost,
        ingredientBreakdown,
    };
}
