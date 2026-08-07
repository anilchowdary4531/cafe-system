package com.tiffzy.app.data.model

data class IngredientItem(
    val id: Int,
    val name: String,
    val currentStock: Double,
    val minStock: Double,
    val unit: String,
    val isLowStock: Boolean = currentStock <= minStock,
    val updatedAt: String? = null
)

data class InventoryAdjustmentRequest(
    val ingredientId: Int,
    val type: String,
    val quantity: Double,
    val reason: String? = null
)

data class InventoryLog(
    val id: Int,
    val ingredientName: String,
    val type: String,
    val changeQty: Double,
    val unit: String,
    val timestamp: String,
    val reason: String? = null
)

data class InventoryResponse(
    val ingredients: List<IngredientItem> = emptyList(),
    val lowStockCount: Int = 0,
    val history: List<InventoryLog> = emptyList()
)
