import * as inventoryController from "../controllers/inventoryController.js";

export default async function inventoryRoutes(app) {
    // Raw Materials Master
    app.get("/owner/:restaurantId/inventory/materials", inventoryController.getMaterials);
    app.post("/owner/:restaurantId/inventory/materials", inventoryController.createMaterial);
    app.put("/owner/:restaurantId/inventory/materials/:id", inventoryController.updateMaterial);
    app.delete("/owner/:restaurantId/inventory/materials/:id", inventoryController.deleteMaterial);

    // Recipe & BOM Builder
    app.post("/owner/:restaurantId/inventory/recipes", inventoryController.upsertRecipe);
    app.get("/owner/:restaurantId/inventory/recipes/cost", inventoryController.getRecipeCost);

    // Stock Operations (Stock-in, Adjustments, Wastage)
    app.post("/owner/:restaurantId/inventory/stock-in", inventoryController.recordStockIn);
    app.post("/owner/:restaurantId/inventory/adjustments", inventoryController.recordAdjustment);
    app.post("/owner/:restaurantId/inventory/wastage", inventoryController.recordWastage);

    // Ledger, Reports & Settings
    app.get("/owner/:restaurantId/inventory/ledger", inventoryController.getLedger);
    app.get("/owner/:restaurantId/inventory/reports", inventoryController.getReport);
    app.put("/owner/:restaurantId/inventory/settings", inventoryController.updateSettings);
}
