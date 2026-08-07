package com.tiffzy.app.ui.customer.cart

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tiffzy.app.data.model.CartItem
import com.tiffzy.app.data.model.Restaurant
import com.tiffzy.app.data.repository.CartRepository
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.combine

data class CartUiState(
    val items: List<CartItem> = emptyList(),
    val subtotal: Double = 0.0,
    val tax: Double = 0.0,
    val serviceCharge: Double = 0.0,
    val total: Double = 0.0,
    val restaurant: Restaurant? = null
)

class CartViewModel(
    val cartRepository: CartRepository = CartRepository.getInstance()
) : ViewModel() {

    val uiState: StateFlow<CartUiState> = combine(
        cartRepository.cartItems,
        cartRepository.currentRestaurant
    ) { items, restaurant ->
        val subtotal = items.sumOf { it.menuItem.price * it.quantity }
        
        val tax = if (restaurant?.taxEnabled == true) {
            (subtotal * restaurant.taxPercent) / 100.0
        } else 0.0
        
        // Check for service charge if available in data model (added to Restaurant.kt in previous steps but let's be safe)
        // For now, based on React analysis, only subtotal and tax were prominent, 
        // but backend schema has serviceChargeEnabled.
        
        CartUiState(
            items = items,
            subtotal = subtotal,
            tax = tax,
            total = subtotal + tax,
            restaurant = restaurant
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = CartUiState()
    )

    fun increaseQuantity(itemId: Int) {
        cartRepository.increaseQuantity(itemId)
    }

    fun decreaseQuantity(itemId: Int) {
        cartRepository.decreaseQuantity(itemId)
    }

    fun removeItem(itemId: Int) {
        cartRepository.removeFromCart(itemId)
    }

    fun clearCart() {
        cartRepository.clearCart()
    }
}
