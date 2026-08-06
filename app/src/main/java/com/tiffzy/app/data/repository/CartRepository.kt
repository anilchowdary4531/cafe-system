package com.tiffzy.app.data.repository

import com.tiffzy.app.data.model.CartItem
import com.tiffzy.app.data.model.MenuItem
import com.tiffzy.app.data.model.Restaurant
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

class CartRepository {
    private val _cartItems = MutableStateFlow<List<CartItem>>(emptyList())
    val cartItems: StateFlow<List<CartItem>> = _cartItems.asStateFlow()

    private val _currentRestaurant = MutableStateFlow<Restaurant?>(null)
    val currentRestaurant: StateFlow<Restaurant?> = _currentRestaurant.asStateFlow()

    private val _selectedTable = MutableStateFlow<String?>(null)
    val selectedTable: StateFlow<String?> = _selectedTable.asStateFlow()

    fun setTable(tableNo: String?) {
        _selectedTable.value = tableNo
    }

    fun getTable(): String? = _selectedTable.value

    fun addToCart(item: MenuItem, restaurant: Restaurant) {
        // Rule: If adding from a different restaurant, clear the cart first
        if (_currentRestaurant.value != null && _currentRestaurant.value?.id != restaurant.id) {
            _cartItems.value = emptyList()
        }
        _currentRestaurant.value = restaurant

        _cartItems.update { currentItems ->
            val existing = currentItems.find { it.menuItem.id == item.id }
            if (existing != null) {
                currentItems.map {
                    if (it.menuItem.id == item.id) it.copy(quantity = it.quantity + 1) else it
                }
            } else {
                currentItems + CartItem(
                    menuItem = item,
                    quantity = 1,
                    restaurantSlug = restaurant.slug,
                    restaurantName = restaurant.name
                )
            }
        }
    }

    fun increaseQuantity(itemId: Int) {
        _cartItems.update { currentItems ->
            currentItems.map {
                if (it.menuItem.id == itemId) it.copy(quantity = it.quantity + 1) else it
            }
        }
    }

    fun decreaseQuantity(itemId: Int) {
        _cartItems.update { currentItems ->
            currentItems.mapNotNull {
                if (it.menuItem.id == itemId) {
                    if (it.quantity > 1) it.copy(quantity = it.quantity - 1) else null
                } else it
            }
        }
    }

    fun removeFromCart(itemId: Int) {
        _cartItems.update { currentItems ->
            currentItems.filter { it.menuItem.id != itemId }
        }
    }

    fun reorderItems(items: List<CartItem>, restaurant: Restaurant) {
        // Clear current cart and set new restaurant
        _currentRestaurant.value = restaurant
        _cartItems.value = items
    }

    fun clearCart() {
        _cartItems.value = emptyList()
        _currentRestaurant.value = null
    }

    companion object {
        @Volatile
        private var INSTANCE: CartRepository? = null

        fun getInstance(): CartRepository {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: CartRepository().also { INSTANCE = it }
            }
        }
    }
}
