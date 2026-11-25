import * as inventoryController from "../controllers/inventoryController.js";
import { requireSupplyActor } from "../middleware/supplyAuth.js";

export default async function inventoryRoutes(app) {
    const requireInventoryActor = requireSupplyActor({ requiredModules: ["inventory", "supply"] });

    // Raw Materials Master
    app.get("/owner/:restaurantId/inventory/materials", { preHandler: [requireInventoryActor] }, inventoryController.getMaterials);
    app.post("/owner/:restaurantId/inventory/materials", { preHandler: [requireInventoryActor] }, inventoryController.createMaterial);
    app.put("/owner/:restaurantId/inventory/materials/:id", { preHandler: [requireInventoryActor] }, inventoryController.updateMaterial);
    app.delete("/owner/:restaurantId/inventory/materials/:id", { preHandler: [requireInventoryActor] }, inventoryController.deleteMaterial);

    // Recipe & BOM Builder
    app.post("/owner/:restaurantId/inventory/recipes", { preHandler: [requireInventoryActor] }, inventoryController.upsertRecipe);
    app.get("/owner/:restaurantId/inventory/recipes/cost", { preHandler: [requireInventoryActor] }, inventoryController.getRecipeCost);

    // Stock Operations (Stock-in, Adjustments, Wastage)
    app.post("/owner/:restaurantId/inventory/stock-in", { preHandler: [requireInventoryActor] }, inventoryController.recordStockIn);
    app.post("/owner/:restaurantId/inventory/adjustments", { preHandler: [requireInventoryActor] }, inventoryController.recordAdjustment);
    app.post("/owner/:restaurantId/inventory/wastage", { preHandler: [requireInventoryActor] }, inventoryController.recordWastage);

    // Ledger, Reports & Settings
    app.get("/owner/:restaurantId/inventory/batches", { preHandler: [requireInventoryActor] }, inventoryController.getBatches);
    app.get("/owner/:restaurantId/inventory/ledger", { preHandler: [requireInventoryActor] }, inventoryController.getLedger);
    app.get("/owner/:restaurantId/inventory/reports", { preHandler: [requireInventoryActor] }, inventoryController.getReport);
    app.put("/owner/:restaurantId/inventory/settings", { preHandler: [requireInventoryActor] }, inventoryController.updateSettings);
}
