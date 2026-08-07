package com.tiffzy.app.ui.payment

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tiffzy.app.data.model.MenuItem
import com.tiffzy.app.data.model.MenuItemRequest
import com.tiffzy.app.data.remote.RetrofitClient
import com.tiffzy.app.data.repository.RestaurantRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class MenuManagementUiState(
    val isLoading: Boolean = false,
    val searchQuery: String = "",
    val selectedCategory: String = "All",
    val menuItems: List<MenuItem> = emptyList(),
    val error: String? = null
)

class MenuManagementViewModel(
    private val repository: RestaurantRepository = RestaurantRepository(RetrofitClient.apiService)
) : ViewModel() {

    private val _uiState = MutableStateFlow(MenuManagementUiState())
    val uiState: StateFlow<MenuManagementUiState> = _uiState.asStateFlow()

    fun loadMenu(slug: String = "tiffzy-kitchen") {
        _uiState.update { it.copy(isLoading = true, error = null) }
        viewModelScope.launch {
            try {
                val resp = repository.getRestaurantMenu(slug)
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        menuItems = resp.menu.ifEmpty { defaultMockMenuItems() }
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        menuItems = defaultMockMenuItems()
                    )
                }
            }
        }
    }

    fun updateSearch(query: String) {
        _uiState.update { it.copy(searchQuery = query) }
    }

    fun selectCategory(category: String) {
        _uiState.update { it.copy(selectedCategory = category) }
    }

    fun saveMenuItem(request: MenuItemRequest, slug: String = "tiffzy-kitchen") {
        viewModelScope.launch {
            if (request.id == null) {
                repository.createMenuItem(request)
            } else {
                repository.updateMenuItem(request.id, request)
            }

            // Local fallback update for seamless sync
            _uiState.update { state ->
                val updatedList = if (request.id == null) {
                    val newItem = MenuItem(
                        id = (state.menuItems.maxOfOrNull { it.id } ?: 0) + 1,
                        name = request.name,
                        description = request.description,
                        category = request.category,
                        image = request.image,
                        price = request.price,
                        isAvailable = request.isAvailable,
                        isVeg = request.isVeg,
                        spicyLevel = request.spicyLevel,
                        discountPercentage = request.discountPercentage,
                        preparationTime = request.preparationTime
                    )
                    state.menuItems + newItem
                } else {
                    state.menuItems.map { item ->
                        if (item.id == request.id) {
                            item.copy(
                                name = request.name,
                                description = request.description,
                                category = request.category,
                                image = request.image,
                                price = request.price,
                                isAvailable = request.isAvailable,
                                isVeg = request.isVeg,
                                spicyLevel = request.spicyLevel,
                                discountPercentage = request.discountPercentage,
                                preparationTime = request.preparationTime
                            )
                        } else item
                    }
                }
                state.copy(menuItems = updatedList)
            }
        }
    }

    fun toggleAvailability(item: MenuItem) {
        val newStatus = !item.isAvailable
        viewModelScope.launch {
            repository.toggleItemAvailability(item.id, newStatus)
            _uiState.update { state ->
                val updatedList = state.menuItems.map {
                    if (it.id == item.id) it.copy(isAvailable = newStatus) else it
                }
                state.copy(menuItems = updatedList)
            }
        }
    }

    fun deleteMenuItem(itemId: Int) {
        viewModelScope.launch {
            repository.deleteMenuItem(itemId)
            _uiState.update { state ->
                state.copy(menuItems = state.menuItems.filterNot { it.id == itemId })
            }
        }
    }

    private fun defaultMockMenuItems(): List<MenuItem> {
        return listOf(
            MenuItem(1, "Paneer Butter Masala", "Rich cottage cheese in creamy tomato gravy", "Main Course", null, 280.0, true, true, 4.8, 120, 450, isVeg = true, spicyLevel = "Medium", discountPercentage = 10, preparationTime = "15-20 mins"),
            MenuItem(2, "Chicken Tikka Biryani", "Fragrant basmati rice with spiced chicken tikka", "Main Course", null, 340.0, true, false, 4.9, 210, 890, isVeg = false, spicyLevel = "High", discountPercentage = 0, preparationTime = "20-25 mins"),
            MenuItem(3, "Butter Naan", "Leavened flatbread brushed with fresh butter", "Breads", null, 45.0, true, false, 4.6, 90, 1200, isVeg = true, spicyLevel = "Low", discountPercentage = 0, preparationTime = "10 mins"),
            MenuItem(4, "Gulab Jamun (2 Pcs)", "Traditional fried milk-solid balls in sugar syrup", "Desserts", null, 90.0, false, false, 4.7, 85, 340, isVeg = true, spicyLevel = "Low", discountPercentage = 15, preparationTime = "5 mins")
        )
    }
}
