package com.tiffzy.app.ui.customer.menu

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tiffzy.app.data.model.MenuItem
import com.tiffzy.app.data.model.Restaurant
import com.tiffzy.app.data.remote.RetrofitClient
import com.tiffzy.app.data.repository.CartRepository
import com.tiffzy.app.data.repository.RestaurantRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class MenuUiState {
    object Loading : MenuUiState()
    data class Success(
        val restaurant: Restaurant,
        val categories: List<MenuCategory>,
        val menu: List<MenuItem> = emptyList()
    ) : MenuUiState()
    data class Error(val message: String) : MenuUiState()
}

data class MenuCategory(
    val name: String,
    val items: List<MenuItem>
)

class MenuViewModel(
    private val repository: RestaurantRepository = RestaurantRepository(RetrofitClient.apiService),
    private val cartRepository: CartRepository = CartRepository.getInstance()
) : ViewModel() {

    private val _uiState = MutableStateFlow<MenuUiState>(MenuUiState.Loading)
    val uiState: StateFlow<MenuUiState> = _uiState.asStateFlow()

    private val _activeSessionId = MutableStateFlow<Int?>(null)
    val activeSessionId: StateFlow<Int?> = _activeSessionId.asStateFlow()

    fun loadMenu(slug: String) {
        viewModelScope.launch {
            _uiState.value = MenuUiState.Loading
            try {
                val response = repository.getRestaurantMenu(slug)
                val allItems = response.menu.filter { it.isAvailable }
                
                val categories = allItems
                    .groupBy { it.category }
                    .map { (category, items) ->
                        MenuCategory(
                            name = category,
                            items = items
                        )
                    }
                    .filter { it.items.isNotEmpty() }
                    .toMutableList()

                // Add Recommended category if featured items exist
                val featuredItems = allItems.filter { it.isFeatured }
                if (featuredItems.isNotEmpty()) {
                    categories.add(0, MenuCategory("Recommended", featuredItems))
                }

                _uiState.value = MenuUiState.Success(
                    restaurant = response.restaurant,
                    categories = categories.sortedBy { if (it.name == "Recommended") 0 else 1 },
                    menu = allItems
                )

                // Check for active table session
                val tableNo = cartRepository.selectedTable.value
                if (tableNo != null) {
                    try {
                        val session = repository.openTable(response.restaurant.id, tableNo)
                        _activeSessionId.value = session.id
                    } catch (e: Exception) {
                        _activeSessionId.value = null
                    }
                }
            } catch (e: Exception) {
                _uiState.value = MenuUiState.Error(e.message ?: "Failed to load menu")
            }
        }
    }

    fun addToCart(item: MenuItem) {
        val currentState = _uiState.value
        if (currentState is MenuUiState.Success) {
            cartRepository.addToCart(item, currentState.restaurant)
        }
    }
}
