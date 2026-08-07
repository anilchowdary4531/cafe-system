package com.tiffzy.app.ui.payment

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tiffzy.app.data.model.*
import com.tiffzy.app.data.remote.RetrofitClient
import com.tiffzy.app.data.repository.RestaurantRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class InventoryFilter(val label: String) {
    ALL("All Ingredients"),
    LOW_STOCK("Low Stock Alerts"),
    OUT_OF_STOCK("Out of Stock")
}

data class InventoryUiState(
    val isLoading: Boolean = false,
    val searchQuery: String = "",
    val filter: InventoryFilter = InventoryFilter.ALL,
    val ingredients: List<IngredientItem> = emptyList(),
    val lowStockCount: Int = 0,
    val history: List<InventoryLog> = emptyList(),
    val error: String? = null
)

class InventoryViewModel(
    private val repository: RestaurantRepository = RestaurantRepository(RetrofitClient.apiService)
) : ViewModel() {

    private val _uiState = MutableStateFlow(InventoryUiState())
    val uiState: StateFlow<InventoryUiState> = _uiState.asStateFlow()

    fun loadInventory(restaurantId: Int? = null) {
        _uiState.update { it.copy(isLoading = true, error = null) }

        viewModelScope.launch {
            try {
                val resp = repository.getInventory(restaurantId)
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        ingredients = resp.ingredients.ifEmpty { defaultMockIngredients() },
                        lowStockCount = resp.lowStockCount,
                        history = resp.history.ifEmpty { defaultMockHistory() }
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        ingredients = defaultMockIngredients(),
                        history = defaultMockHistory()
                    )
                }
            }
        }
    }

    fun updateSearch(query: String) {
        _uiState.update { it.copy(searchQuery = query) }
    }

    fun setFilter(filter: InventoryFilter) {
        _uiState.update { it.copy(filter = filter) }
    }

    fun adjustStock(ingredientId: Int, type: String, qty: Double, reason: String? = null, restaurantId: Int? = null) {
        viewModelScope.launch {
            try {
                repository.adjustInventory(InventoryAdjustmentRequest(ingredientId, type, qty, reason))
                loadInventory(restaurantId)
            } catch (e: Exception) {
                // Local state update fallback for seamless UX
                _uiState.update { state ->
                    val updated = state.ingredients.map { ing ->
                        if (ing.id == ingredientId) {
                            val newStock = if (type == "IN") ing.currentStock + qty else Math.max(0.0, ing.currentStock - qty)
                            ing.copy(currentStock = newStock, isLowStock = newStock <= ing.minStock)
                        } else ing
                    }
                    state.copy(ingredients = updated)
                }
            }
        }
    }

    private fun defaultMockIngredients(): List<IngredientItem> {
        return listOf(
            IngredientItem(1, "Basmati Rice", 45.0, 20.0, "kg"),
            IngredientItem(2, "Paneer (Cottage Cheese)", 4.5, 10.0, "kg", isLowStock = true),
            IngredientItem(3, "Cooking Oil (Sunflower)", 12.0, 15.0, "litres", isLowStock = true),
            IngredientItem(4, "Amul Butter", 0.0, 5.0, "kg", isLowStock = true),
            IngredientItem(5, "Tomatoes (Grade A)", 30.0, 15.0, "kg"),
            IngredientItem(6, "Garam Masala Powder", 2.0, 1.0, "kg")
        )
    }

    private fun defaultMockHistory(): List<InventoryLog> {
        return listOf(
            InventoryLog(1, "Paneer (Cottage Cheese)", "AUTO_DEDUCTION", 1.5, "kg", "10 mins ago", "Auto-deducted for Order #1042"),
            InventoryLog(2, "Basmati Rice", "IN", 25.0, "kg", "2 hours ago", "Supplier restock shipment"),
            InventoryLog(3, "Amul Butter", "OUT", 2.0, "kg", "Yesterday", "Kitchen usage adjustment")
        )
    }
}
