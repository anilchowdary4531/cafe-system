import * as inventoryService from "../services/inventoryService.js";
import * as recipeService from "../services/recipeService.js";
import { emitInventoryUpdated } from "../realtime/socketServer.js";

function getActor(req) {
    return {
        userId: req.user?.id || req.user?.userId || null,
        userName: req.user?.name || req.user?.userName || "Staff",
        role: req.user?.role || "STAFF",
    };
}

export async function getMaterials(req, res) {
    try {
        const restaurantId = Number(req.params.restaurantId);
        const { search, category, lowStockOnly } = req.query;

        const materials = await inventoryService.getRawMaterials({
            prisma: req.prisma,
            restaurantId,
            search,
            category,
            lowStockOnly: lowStockOnly === "true",
        });

        res.send({ materials });
    } catch (err) {
        console.error("Error fetching raw materials:", err);
        res.status(500).send({ message: err.message || "Failed to fetch raw materials" });
    }
}

export async function createMaterial(req, res) {
    try {
        const restaurantId = Number(req.params.restaurantId);
        const actor = getActor(req);

        const material = await inventoryService.createRawMaterial({
            prisma: req.prisma,
            restaurantId,
            ...req.body,
            actor,
        });

        emitInventoryUpdated(req.io, restaurantId, { type: "MATERIAL_CREATED", materialId: material.id });
        res.status(201).send({ message: "Raw material created successfully", material });
    } catch (err) {
        console.error("Error creating raw material:", err);
        const status = err.code === "duplicate_material" || err.code === "invalid_input" ? 400 : 500;
        res.status(status).send({ message: err.message || "Failed to create raw material" });
    }
}

export async function updateMaterial(req, res) {
    try {
        const restaurantId = Number(req.params.restaurantId);
        const id = Number(req.params.id);

        const material = await inventoryService.updateRawMaterial({
            prisma: req.prisma,
            restaurantId,
            id,
            data: req.body,
        });

        emitInventoryUpdated(req.io, restaurantId, { type: "MATERIAL_UPDATED", materialId: id });
        res.send({ message: "Raw material updated successfully", material });
    } catch (err) {
        console.error("Error updating raw material:", err);
        const status = err.code === "not_found" ? 404 : 500;
        res.status(status).send({ message: err.message || "Failed to update raw material" });
    }
}

export async function deleteMaterial(req, res) {
    try {
        const restaurantId = Number(req.params.restaurantId);
        const id = Number(req.params.id);

        await inventoryService.deleteRawMaterial({
            prisma: req.prisma,
            restaurantId,
            id,
        });

        emitInventoryUpdated(req.io, restaurantId, { type: "MATERIAL_DELETED", materialId: id });
        res.send({ message: "Raw material deleted successfully" });
    } catch (err) {
        console.error("Error deleting raw material:", err);
        res.status(500).send({ message: err.message || "Failed to delete raw material" });
    }
}

export async function upsertRecipe(req, res) {
    try {
        const restaurantId = Number(req.params.restaurantId);
        const { menuItemId, variantId, modifierId, name, items } = req.body;

        const recipe = await recipeService.upsertRecipe({
            prisma: req.prisma,
            restaurantId,
            menuItemId,
            variantId,
            modifierId,
            name,
            items,
        });

        emitInventoryUpdated(req.io, restaurantId, { type: "RECIPE_SAVED", recipeId: recipe.id });
        res.send({ message: "Recipe saved successfully", recipe });
    } catch (err) {
        console.error("Error saving recipe:", err);
        const status = err.code === "invalid_input" || err.code === "incompatible_unit" ? 400 : 500;
        res.status(status).send({ message: err.message || "Failed to save recipe" });
    }
}

export async function getRecipeCost(req, res) {
    try {
        const restaurantId = Number(req.params.restaurantId);
        const { menuItemId, variantId } = req.query;

        const costData = await recipeService.calculateRecipeCost({
            prisma: req.prisma,
            restaurantId,
            menuItemId: menuItemId ? Number(menuItemId) : null,
            variantId: variantId ? Number(variantId) : null,
        });

        res.send(costData);
    } catch (err) {
        console.error("Error calculating recipe cost:", err);
        res.status(500).send({ message: err.message || "Failed to calculate recipe cost" });
    }
}

export async function recordStockIn(req, res) {
    try {
        const restaurantId = Number(req.params.restaurantId);
        const actor = getActor(req);

        const result = await inventoryService.recordStockIn({
            prisma: req.prisma,
            restaurantId,
            ...req.body,
            actor,
        });

        emitInventoryUpdated(req.io, restaurantId, { type: "STOCK_IN", materialId: req.body.rawMaterialId });
        res.status(201).send({ message: "Stock-in recorded successfully", ...result });
    } catch (err) {
        console.error("Error recording stock-in:", err);
        res.status(500).send({ message: err.message || "Failed to record stock-in" });
    }
}

export async function recordAdjustment(req, res) {
    try {
        const restaurantId = Number(req.params.restaurantId);
        const actor = getActor(req);

        const result = await inventoryService.recordStockAdjustment({
            prisma: req.prisma,
            restaurantId,
            ...req.body,
            actor,
        });

        emitInventoryUpdated(req.io, restaurantId, { type: "STOCK_ADJUSTMENT", materialId: req.body.rawMaterialId });
        res.status(201).send({ message: "Stock adjustment recorded successfully", ...result });
    } catch (err) {
        console.error("Error recording stock adjustment:", err);
        res.status(500).send({ message: err.message || "Failed to record stock adjustment" });
    }
}

export async function recordWastage(req, res) {
    try {
        const restaurantId = Number(req.params.restaurantId);
        const actor = getActor(req);

        const result = await inventoryService.recordWastage({
            prisma: req.prisma,
            restaurantId,
            ...req.body,
            actor,
        });

        emitInventoryUpdated(req.io, restaurantId, { type: "WASTAGE", materialId: req.body.rawMaterialId });
        res.status(201).send({ message: "Wastage recorded successfully", ...result });
    } catch (err) {
        console.error("Error recording wastage:", err);
        res.status(500).send({ message: err.message || "Failed to record wastage" });
    }
}

export async function getLedger(req, res) {
    try {
        const restaurantId = Number(req.params.restaurantId);
        const { rawMaterialId, movementType, startDate, endDate, limit, offset } = req.query;

        const data = await inventoryService.getStockLedger({
            prisma: req.prisma,
            restaurantId,
            rawMaterialId,
            movementType,
            startDate,
            endDate,
            limit,
            offset,
        });

        res.send(data);
    } catch (err) {
        console.error("Error fetching stock ledger:", err);
        res.status(500).send({ message: err.message || "Failed to fetch stock ledger" });
    }
}

export async function getReport(req, res) {
    try {
        const restaurantId = Number(req.params.restaurantId);

        const report = await inventoryService.getInventoryReport({
            prisma: req.prisma,
            restaurantId,
        });

        res.send({ report });
    } catch (err) {
        console.error("Error generating inventory report:", err);
        res.status(500).send({ message: err.message || "Failed to generate inventory report" });
    }
}

export async function updateSettings(req, res) {
    try {
        const restaurantId = Number(req.params.restaurantId);
        const { allowNegativeStock } = req.body;

        const restaurant = await req.prisma.restaurant.update({
            where: { id: restaurantId },
            data: {
                allowNegativeStock: Boolean(allowNegativeStock),
            },
            select: { id: true, allowNegativeStock: true },
        });

        res.send({ message: "Inventory settings updated successfully", restaurant });
    } catch (err) {
        console.error("Error updating inventory settings:", err);
        res.status(500).send({ message: err.message || "Failed to update inventory settings" });
    }
}
